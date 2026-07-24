import { PowerShell } from 'node-powershell';
import { z } from 'zod';
import { sendResendEmail } from './email-tools.js';

/**
 * PowerShell's ConvertTo-Json returns a bare object for a single result and
 * an array for multiple results. Normalize both cases to an array.
 */
function parseJsonResults(output) {
  try {
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    return [];
  }
}

/**
 * Execute a system command safely
 */
async function executeSystemCommand(command) {
  const ps = new PowerShell({
    executableOptions: {
      '-ExecutionPolicy': 'Bypass',
      '-NoProfile': true,
    }
  });
  
  try {
    const result = await ps.invoke(command);
    return {
      success: true,
      output: result.raw || 'Command executed successfully.',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  } finally {
    await ps.dispose();
  }
}

/**
 * Register system information and monitoring tools
 */
export function registerSystemTools(server) {

  // Comprehensive system information
  server.tool(
    'get-system-info',
    'Get comprehensive Windows system information including hardware, OS, and performance metrics',
    {},
    async () => {
      try {
        const command = `
          $computerInfo = Get-ComputerInfo
          $osInfo = Get-WmiObject -Class Win32_OperatingSystem
          $cpuInfo = Get-WmiObject -Class Win32_Processor
          $memInfo = Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
          
          $systemInfo = @{
            'Computer Name' = $computerInfo.WindowsProductName
            'OS Version' = $computerInfo.WindowsVersion
            'Build Number' = $computerInfo.WindowsBuildLabEx
            'Total RAM (GB)' = [math]::Round($memInfo.Sum / 1GB, 2)
            'CPU Name' = ($cpuInfo | Select-Object -First 1).Name
            'CPU Cores' = ($cpuInfo | Measure-Object -Property NumberOfCores -Sum).Sum
            'CPU Logical Processors' = ($cpuInfo | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
            'System Uptime' = (Get-Date) - [Management.ManagementDateTimeConverter]::ToDateTime($osInfo.LastBootUpTime)
            'Current User' = $env:USERNAME
            'Computer Domain' = $computerInfo.CsDomain
            'TimeZone' = $computerInfo.TimeZone
            'Last Boot Time' = [Management.ManagementDateTimeConverter]::ToDateTime($osInfo.LastBootUpTime)
          }
          
          $systemInfo | ConvertTo-Json -Depth 2
        `;
        
        const result = await executeSystemCommand(command);
        
        if (result.success) {
          return {
            content: [{
              type: 'text',
              text: `🖥️ **System Information**\n\n\`\`\`json\n${result.output}\n\`\`\`\n\n📅 Retrieved: ${result.timestamp}`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ Failed to get system information:\n\n${result.error}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `💥 Unexpected error getting system info: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Process list with CPU and memory usage
  server.tool(
    'get-process-list',
    'Get list of running processes with CPU and memory usage, optionally filtered by name',
    {
      processName: z.string().optional().describe('Optional process name filter'),
      sortBy: z.enum(['CPU', 'Memory', 'Name']).optional().default('CPU').describe('Sort processes by CPU, Memory, or Name'),
      limit: z.number().optional().default(10).describe('Maximum number of processes to return (default: 10)')
    },
    async ({ processName, sortBy, limit }) => {
      try {
        let command = 'Get-Process';
        if (processName) {
          command += ` -Name "*${processName}*" -ErrorAction SilentlyContinue`;
        }
        
        command += ` | Sort-Object ${sortBy === 'Memory' ? 'WorkingSet' : sortBy} -Descending | Select-Object -First ${limit} Name, Id, CPU, @{Name="Memory(MB)";Expression={[math]::Round($_.WorkingSet / 1MB, 2)}}, ProcessName | ConvertTo-Json`;
        
        const result = await executeSystemCommand(command);
        
        if (result.success) {
          return {
            content: [{
              type: 'text',
              text: `📊 **Running Processes** (Top ${limit}, sorted by ${sortBy})${processName ? `\n\n🔍 Filter: "${processName}"` : ''}\n\n\`\`\`json\n${result.output}\n\`\`\`\n\n📅 Retrieved: ${result.timestamp}`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ Failed to get process list:\n\n${result.error}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `💥 Unexpected error getting process list: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Windows service status
  server.tool(
    'get-service-status',
    'Get Windows service status, optionally filtered by service name or status, and optionally sending a Resend email alert when matching services are found stopped',
    {
      serviceName: z.string().optional().describe('Optional service name filter'),
      status: z.enum(['Running', 'Stopped', 'All']).optional().default('All').describe('Filter by service status'),
      alertOnStopped: z.boolean().optional().default(false).describe('If true, send an email alert when any matched service is stopped'),
      alertEmail: z.string().optional().describe('Recipient email address for the alert (requires RESEND_API_KEY to be configured); required when alertOnStopped is true')
    },
    async ({ serviceName, status, alertOnStopped, alertEmail }) => {
      try {
        let command = 'Get-Service';
        if (serviceName) {
          command += ` -Name "*${serviceName}*" -ErrorAction SilentlyContinue`;
        }

        if (status !== 'All') {
          command += ` | Where-Object {$_.Status -eq "${status}"}`;
        }

        command += ' | Select-Object Name, Status, StartType, DisplayName | Sort-Object Name | ConvertTo-Json';

        const result = await executeSystemCommand(command);

        if (result.success) {
          let alertText = '';

          if (alertOnStopped) {
            const services = parseJsonResults(result.output);
            const stopped = services.filter(s => s.Status === 'Stopped');

            if (stopped.length > 0) {
              if (!alertEmail) {
                alertText = `\n\n⚠️ ${stopped.length} matched service(s) are stopped, but no alertEmail was provided so no alert was sent.`;
              } else {
                const summary = stopped.map(s => `${s.DisplayName || s.Name} (${s.Name})`).join('\n');
                const emailResult = await sendResendEmail({
                  to: alertEmail,
                  subject: `⚠️ Stopped service alert${serviceName ? ` (${serviceName})` : ''}`,
                  text: `The following service(s) are stopped:\n\n${summary}`
                });
                alertText = emailResult.success
                  ? `\n\n📧 Alert email sent to ${alertEmail} (${stopped.length} stopped service(s)).`
                  : `\n\n❌ Failed to send alert email: ${emailResult.error}`;
              }
            }
          }

          return {
            content: [{
              type: 'text',
              text: `🔧 **Windows Services**${serviceName ? `\n\n🔍 Filter: "${serviceName}"` : ''}\n📊 Status: ${status}\n\n\`\`\`json\n${result.output}\n\`\`\`\n\n📅 Retrieved: ${result.timestamp}${alertText}`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ Failed to get service status:\n\n${result.error}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `💥 Unexpected error getting service status: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Disk space information
  server.tool(
    'check-disk-space',
    'Check disk space usage for all drives or a specific drive, optionally sending a Resend email alert when free space drops below a threshold',
    {
      drive: z.string().optional().describe('Optional drive letter (e.g., "C:", "D:") to check specific drive'),
      alertBelowPercentFree: z.number().optional().describe('If set, send an email alert when any checked drive has less than this percent free space'),
      alertEmail: z.string().optional().describe('Recipient email address for the alert (requires RESEND_API_KEY to be configured); required when alertBelowPercentFree is set')
    },
    async ({ drive, alertBelowPercentFree, alertEmail }) => {
      try {
        let command = 'Get-WmiObject -Class Win32_LogicalDisk';
        if (drive) {
          command += ` | Where-Object {$_.DeviceID -eq "${drive.toUpperCase()}"}`;
        }

        command += ` | Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size / 1GB, 2)}}, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace / 1GB, 2)}}, @{Name="UsedSpace(GB)";Expression={[math]::Round(($_.Size - $_.FreeSpace) / 1GB, 2)}}, @{Name="PercentFree";Expression={[math]::Round(($_.FreeSpace / $_.Size) * 100, 2)}}, FileSystem, VolumeName | ConvertTo-Json`;

        const result = await executeSystemCommand(command);

        if (result.success) {
          let alertText = '';

          if (alertBelowPercentFree !== undefined) {
            const disks = parseJsonResults(result.output);
            const lowDisks = disks.filter(d => typeof d.PercentFree === 'number' && d.PercentFree < alertBelowPercentFree);

            if (lowDisks.length > 0) {
              if (!alertEmail) {
                alertText = `\n\n⚠️ ${lowDisks.length} drive(s) below ${alertBelowPercentFree}% free, but no alertEmail was provided so no alert was sent.`;
              } else {
                const summary = lowDisks.map(d => `${d.DeviceID}: ${d.PercentFree}% free`).join('\n');
                const emailResult = await sendResendEmail({
                  to: alertEmail,
                  subject: `⚠️ Low disk space alert${drive ? ` (${drive})` : ''}`,
                  text: `The following drive(s) are below ${alertBelowPercentFree}% free space:\n\n${summary}`
                });
                alertText = emailResult.success
                  ? `\n\n📧 Alert email sent to ${alertEmail} (${lowDisks.length} drive(s) below threshold).`
                  : `\n\n❌ Failed to send alert email: ${emailResult.error}`;
              }
            }
          }

          return {
            content: [{
              type: 'text',
              text: `💾 **Disk Space Usage**${drive ? `\n\n🔍 Drive: ${drive}` : '\n📊 All Drives'}\n\n\`\`\`json\n${result.output}\n\`\`\`\n\n📅 Retrieved: ${result.timestamp}${alertText}`
            }]
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `❌ Failed to check disk space:\n\n${result.error}`
            }],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `💥 Unexpected error checking disk space: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}
