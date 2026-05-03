# Configuration Guide

Copy `example.config.json` to your own config file (e.g. `myproject.config.json`) and adjust the values below.

## Running the extractor

```bash
npm install
node client.js myproject.config.json
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `JDTLS_SERVER_DIR` | Absolute path to the JDTLS `server` directory inside the VS Code Java extension. Typically located at `~/.vscode/extensions/redhat.java-<version>-<platform>/server`. |
| `PROJECT_DIR` | Absolute path to the root directory of the Java project to analyze. Must contain `.java` source files. |
| `WORKSPACE_DIR` | Working directory for JDTLS. Created automatically if it does not exist. Use a unique path per project. |
| `OUTPUT_FILE` | Name of the output file. The generated graph will be saved in the same directory as `client.js`. |
| `XMX` | Maximum JVM heap size for JDTLS. Default `2G` is sufficient for most projects. Increase to `4G` or more for large projects (e.g. NetBeans with 2238 classes). |
| `SKIP_DIRS` | List of directory names to exclude from file discovery. |
| `CONCURRENCY` | Number of concurrent LSP requests. Reduce to `1` if JDTLS becomes unresponsive or returns incomplete results. |
| `TIMEOUT` | Timeout in milliseconds for each LSP request type. Increase for slow machines or very large source files. |

## Platform-specific paths

**Windows:**
```
"JDTLS_SERVER_DIR": "C:/Users/<user>/.vscode/extensions/redhat.java-1.54.0-win32-x64/server"
```

**Linux:**
```
"JDTLS_SERVER_DIR": "/home/<user>/.vscode/extensions/redhat.java-1.54.0-linux-x64/server"
```

**macOS:**
```
"JDTLS_SERVER_DIR": "/Users/<user>/.vscode/extensions/redhat.java-1.54.0-darwin-arm64/server"
```

## Note on `editorUri`

The generated graph encodes source references as `vscode://file/...` links using the absolute path from `PROJECT_DIR`. These links work on the machine where the extraction was performed. On a different machine, the links will not resolve unless the project is located at the same path.
