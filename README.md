# PowerShell MCP Server

A comprehensive Model Context Protocol (MCP) server that enables Claude and other LLM applications to execute PowerShell commands, scripts, and perform system operations on Windows systems.

## 🌟 **Key Features**

- **🔧 PowerShell Execution**: Execute commands, run scripts, and create new PowerShell files
- **🖥️ System Monitoring**: Get system info, monitor processes, check services and disk space
- **📁 File Operations**: List directories, get file info, and search files with pattern matching
- **⚙️ Simple Setup**: One-command installation with automatic Claude Desktop configuration
- **🛡️ Secure**: Safe execution with proper error handling and session management

## 🛠️ **Available Tools**

### PowerShell Tools
- `execute-powershell` - Execute PowerShell commands with optional working directory
- `execute-powershell-script` - Run PowerShell script files with parameters  
- `create-powershell-script` - Create new PowerShell scripts

### System Tools
- `get-system-info` - Comprehensive Windows system information
- `get-process-list` - Running processes with CPU/memory usage (sortable/filterable)
- `get-service-status` - Windows services status with filtering
- `check-disk-space` - Disk space usage for all or specific drives

### File Tools
- `list-directory` - Enhanced directory listing with filtering
- `get-file-info` - Detailed file and directory metadata  
- `search-files` - Recursive file search with pattern matching

### Email Tools (via [Resend](https://resend.com))
- `send-email` - Send an email through Resend
- `check-disk-space` and `get-service-status` also accept optional alert parameters (`alertBelowPercentFree`/`alertOnStopped` + `alertEmail`) to automatically email you when a drive runs low on space or a monitored service stops

Email tools require a Resend API key. Add it to the `env` block of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "powershell": {
      "command": "node",
      "args": ["D:/claude/claude-powershell-mcp/src/server.js"],
      "env": {
        "RESEND_API_KEY": "re_your_api_key",
        "RESEND_FROM_EMAIL": "alerts@yourdomain.com"
      }
    }
  }
}
```

`RESEND_FROM_EMAIL` is used as the default sender and can be overridden per-call with the `from` parameter on `send-email`.

## 📋 **Prerequisites**

- **Windows** 10/11 or Windows Server 2016+
- **Node.js** 18.0.0 or higher
- **PowerShell** 5.1+ or PowerShell Core 7+
- **Claude Desktop** application

## 🚀 **Quick Setup**

### Option 1: Safe Automated Setup (Recommended)
```bash
# Clone and setup with configuration management
git clone https://github.com/gunjanjp/powershell-mcp.git
cd powershell-mcp
complete-setup.bat
```

### Option 2: Configuration Recovery (If you had existing settings)
```bash
# If previous setup overwrote your existing configuration
node recovery.js status      # Check current state
node recovery.js scan        # Find backup configurations
node recovery.js restore 1   # Restore from backup
# OR
node recovery.js merge 1     # Merge backup with current config
```

### Option 3: Manual Setup
```bash
# Clone the repository
git clone https://github.com/gunjanjp/powershell-mcp.git
cd powershell-mcp

# Install dependencies
npm install

# Safely add to existing configuration
node recovery.js add-powershell

# Restart Claude Desktop
```

## 📖 **Usage Examples**

Ask Claude:
- *"Execute PowerShell: Get-Date"*
- *"Check my system information"* 
- *"Show me the top 10 processes by CPU usage"*
- *"What's my disk space usage?"*
- *"List files in my Downloads folder"*
- *"Search for all .txt files in C:\Users"*
- *"Create a PowerShell script to backup my Documents folder"*
- *"Email me a summary of my disk space usage"*
- *"Check disk space and alert me at admin@example.com if any drive drops below 10% free"*
- *"Check the status of the Spooler service and email me at admin@example.com if it's stopped"*

## 🔧 **Commands**

### Server Commands
```bash
# Start the server
npm start

# Test components
npm test

# Run diagnostics
node diagnose.bat

# Start server directly  
node src/server.js
```

### Configuration Management
```bash
# Check configuration status
node recovery.js status

# Find backup configurations
node recovery.js scan

# Safely add PowerShell server
node recovery.js add-powershell

# Restore from backup
node recovery.js restore <number>

# Merge configurations
node recovery.js merge <number>

# Show backup contents
node recovery.js show <number>
```

### Quick Setup Commands
```bash
# Complete setup with safety checks
complete-setup.bat

# Test server only
run-test.bat
```

## 📁 **Project Structure**

```
powershell-mcp/
├── src/
│   ├── server.js           # Main MCP server (with stderr logging fix)
│   ├── tools/              # Tool implementations
│   │   ├── powershell-tools.js
│   │   ├── system-tools.js
│   │   ├── file-tools.js
│   │   └── email-tools.js
│   └── utils/              # Utility modules
│       └── system-utils.js
├── examples/               # Example PowerShell scripts
├── scripts/               # Setup utilities
├── test/                  # Test files
├── claude_desktop_config.json  # Claude Desktop configuration
├── setup.bat             # Automated setup script
├── diagnose.bat          # Diagnostic tool
├── test-server.js        # Component testing
└── README.md
```

## ⚙️ **Claude Desktop Configuration**

The server uses this configuration (automatically applied by setup):

```json
{
  "mcpServers": {
    "powershell": {
      "command": "node",
      "args": ["D:/claude/claude-powershell-mcp/src/server.js"],
      "env": {}
    }
  }
}
```

**Config location**: `%APPDATA%\Claude\claude_desktop_config.json`

## 🛡️ **Security Features**

- **Safe Execution**: Uses `-ExecutionPolicy Bypass` and `-NoProfile` for security
- **Input Validation**: All inputs validated with Zod schemas
- **Session Management**: PowerShell sessions properly disposed after use
- **Error Handling**: Comprehensive error handling prevents system issues
- **Logging**: All operations logged to stderr (not interfering with JSON-RPC)

## 🐛 **Troubleshooting**

### Server won't start
```bash
# Check Node.js version (need 18+)
node --version

# Check dependencies
npm install

# Test components
node test-server.js
```

### Claude Desktop integration issues  
```bash
# Run setup again
setup.bat

# Check configuration
type "%APPDATA%\Claude\claude_desktop_config.json"

# Restart Claude Desktop completely
```

### PowerShell execution issues
```bash
# Test PowerShell
powershell -Command "Get-Date"

# Check execution policy
Get-ExecutionPolicy

# Run diagnostics
node diagnose.bat
```

## 🔄 **Recent Updates (v1.1.2)**

### Configuration Management Improvements
- ✅ **Safe Configuration Management** - No more overwriting existing configs
- ✅ **Automatic Backups** - Creates backups before any configuration changes
- ✅ **Configuration Recovery** - Tools to find and restore previous configurations
- ✅ **Merge Capability** - Intelligent merging of multiple MCP server configs
- ✅ **Interactive Recovery** - Step-by-step configuration recovery process

### Previous Fixes (v1.1.1)
- ✅ **Fixed Claude Desktop JSON parsing error** - Changed console.log to console.error (stderr)
- ✅ **Cleaned up project structure** - Removed redundant server files
- ✅ **Simplified setup** - One script setup process
- ✅ **Proper error handling** - Enhanced logging and error management

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test: `npm test`
4. Commit: `git commit -am 'Add feature'`
5. Push: `git push origin feature-name`
6. Submit pull request

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 **Links**

- [GitHub Repository](https://github.com/gunjanjp/powershell-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/)

---

**Made with ❤️ for the Claude and PowerShell communities**

⚠️ **Important**: This tool provides direct access to PowerShell commands. Use responsibly and be aware of security implications.
