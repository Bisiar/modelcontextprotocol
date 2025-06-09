# RFC: Binary Transfer Support for Model Context Protocol

## Summary

This RFC proposes adding native binary transfer capabilities to the Model Context Protocol (MCP) to improve efficiency when transferring large binary data such as images, audio, and other file types.

## Motivation

Currently, MCP requires all binary data to be base64-encoded within JSON-RPC messages. This approach has several limitations:

1. **Size Overhead**: Base64 encoding increases data size by approximately 33%
2. **Processing Overhead**: Encoding/decoding adds computational cost
3. **Memory Usage**: Both encoded and decoded versions must exist in memory during processing
4. **Context Limitations**: The increased size severely limits the amount of binary data that can be transferred, especially for LLMs with token constraints

### Real-World Example

When using an MCP server for screenshot capture (e.g., Snagit integration), images must often be resized from their original dimensions down to 800x800 pixels or smaller to fit within context limits after base64 encoding. This significantly reduces the utility of screenshot sharing for detailed UI work or documentation.

## Proposed Solution

### 1. Binary Transfer Capability Negotiation

Add binary transfer support to capability negotiation:

```typescript
export interface ServerCapabilities {
  // ... existing capabilities ...
  binaryTransfer?: {
    supported: boolean;
    maxBinarySize?: number; // Maximum size in bytes
    supportedModes: ("stream" | "multipart" | "websocket-binary")[];
  };
}

export interface ClientCapabilities {
  // ... existing capabilities ...
  binaryTransfer?: {
    supported: boolean;
    preferredMode?: "stream" | "multipart" | "websocket-binary";
    maxBinarySize?: number;
  };
}
```

### 2. Binary Content Types

Extend existing content types to support binary transfer:

```typescript
export interface BinaryTransferContent {
  type: "image" | "audio" | "blob";
  transferMode: "base64" | "binary";
  mimeType: string;
  
  // For base64 mode (backward compatible)
  data?: string;
  
  // For binary mode
  binaryRef?: {
    streamId: string;
    size: number;
    checksum?: string; // Optional SHA-256 hash
  };
}
```

### 3. Binary Transfer Protocols

#### Option A: Stream-Based Transfer

After sending a JSON-RPC message with a `binaryRef`, the binary data follows in a separate stream:

```
[JSON-RPC Message with binaryRef]
[Binary Stream Header: streamId (16 bytes) + size (8 bytes)]
[Binary Data]
```

#### Option B: HTTP Multipart

For HTTP transports, use `multipart/mixed`:

```
Content-Type: multipart/mixed; boundary=mcp-boundary

--mcp-boundary
Content-Type: application/json

{"jsonrpc":"2.0","method":"...","params":{...}}

--mcp-boundary
Content-Type: image/png
Content-ID: <streamId>

[Binary Data]
--mcp-boundary--
```

#### Option C: WebSocket Binary Frames

For WebSocket transports:
- Text frames contain JSON-RPC messages
- Binary frames contain binary data prefixed with streamId

### 4. Binary Resource Reading

Extend the resource reading capabilities:

```typescript
export interface ReadResourceRequest extends Request {
  method: "resources/read";
  params: {
    uri: string;
    // New optional parameter
    transferMode?: "base64" | "binary";
  };
}

export interface BinaryResourceContents extends ResourceContents {
  // Existing fields
  uri: string;
  mimeType?: string;
  
  // Modified to support both modes
  text?: string; // For text resources
  blob?: string; // For base64-encoded binary
  binaryRef?: {  // For binary transfer mode
    streamId: string;
    size: number;
    checksum?: string;
  };
}
```

## Implementation Considerations

### Backward Compatibility

- Servers and clients that don't support binary transfer continue using base64
- The `transferMode` field defaults to "base64" if not specified
- Binary transfer is only used when both client and server support it

### Security

- Stream IDs should be cryptographically random UUIDs
- Optional checksums allow verification of transferred data
- Size limits prevent memory exhaustion attacks

### Transport-Specific Handling

Different transports may implement binary transfer differently:
- **stdio**: Use length-prefixed binary chunks after JSON messages
- **HTTP**: Use multipart/mixed encoding
- **WebSocket**: Use binary frame support

## Benefits

1. **Reduced Size**: Eliminates 33% base64 overhead
2. **Better Performance**: No encoding/decoding CPU cost
3. **Improved UX**: Full-quality images and media can be transferred
4. **Memory Efficiency**: No need for dual representations in memory

## Migration Path

1. Add binary transfer to SDKs as opt-in feature
2. Update servers to support both modes
3. Clients can gradually adopt binary transfer
4. Eventually make binary transfer the default for supported content types

## Example Usage

### Before (Current Base64 Approach)
```json
{
  "type": "image",
  "data": "iVBORw0KGgoAAAANSUhEUgAA...", // Large base64 string
  "mimeType": "image/png"
}
```

### After (Binary Transfer)
```json
{
  "type": "image",
  "transferMode": "binary",
  "mimeType": "image/png",
  "binaryRef": {
    "streamId": "550e8400-e29b-41d4-a716-446655440000",
    "size": 1048576,
    "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

## Open Questions

1. Should we support streaming for very large files?
2. Should binary transfers support compression?
3. How should progress reporting work for large transfers?
4. Should we add resumable upload support?

## References

- [MCP Specification](https://github.com/modelcontextprotocol/specification)
- [Base64 Overhead Analysis](https://en.wikipedia.org/wiki/Base64#Output_padding)
- [WebSocket Binary Frame Protocol](https://datatracker.ietf.org/doc/html/rfc6455#section-5.2)