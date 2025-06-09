# Binary Transfer Example: Snagit MCP Server

This example demonstrates how an MCP server for Snagit screen captures would benefit from binary transfer support.

## Current Implementation (Base64)

When capturing a 4K screenshot (3840x2160), the current base64 approach has significant limitations:

### Size Calculation
- Original PNG size: ~5MB (5,242,880 bytes)
- Base64 encoded size: ~6.99MB (6,990,507 bytes) 
- Overhead: 33% increase

### Current Flow
```json
// Client request
{
  "jsonrpc": "2.0",
  "method": "snagit/get-last-capture",
  "params": {
    "maxWidth": 800,
    "maxHeight": 800
  },
  "id": 1
}

// Server response (forced to resize due to context limits)
{
  "jsonrpc": "2.0",
  "result": {
    "capture": {
      "type": "image",
      "mimeType": "image/png",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAyAAAAMg...", // ~500KB base64
      "width": 800,
      "height": 450,
      "wasResized": true,
      "originalDimensions": "3840x2160"
    }
  },
  "id": 1
}
```

## With Binary Transfer Support

### Size Benefits
- Original PNG size: ~5MB (5,242,880 bytes)
- Transferred size: ~5MB (5,242,880 bytes)
- Overhead: 0% - no encoding needed!

### New Flow

#### 1. Capability Negotiation
```json
// During initialization
{
  "serverCapabilities": {
    "binaryTransfer": {
      "supported": true,
      "maxBinarySize": 52428800, // 50MB
      "supportedModes": ["stream", "multipart"]
    }
  }
}
```

#### 2. Request with Binary Transfer
```json
// Client request
{
  "jsonrpc": "2.0",
  "method": "snagit/get-last-capture",
  "params": {
    "transferMode": "binary",
    "maxWidth": 4096,  // Can request much larger!
    "maxHeight": 4096
  },
  "id": 1
}

// Server response
{
  "jsonrpc": "2.0",
  "result": {
    "capture": {
      "type": "image",
      "transferMode": "binary",
      "mimeType": "image/png",
      "binaryRef": {
        "streamId": "550e8400-e29b-41d4-a716-446655440000",
        "size": 5242880,
        "checksum": "a7b9c3d2e1f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
      },
      "width": 3840,
      "height": 2160,
      "wasResized": false
    }
  },
  "id": 1
}
```

#### 3. Binary Data Transfer

**Option A: Stream Mode**
```
[Binary Stream Header]
- Magic: "MCP\0" (4 bytes)
- Version: 1 (4 bytes)
- StreamID: 550e8400-e29b-41d4-a716-446655440000 (16 bytes)
- Size: 5242880 (8 bytes)
[Binary PNG Data: 5,242,880 bytes]
```

**Option B: HTTP Multipart**
```http
POST /mcp HTTP/1.1
Content-Type: multipart/mixed; boundary=mcp-boundary

--mcp-boundary
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": {
    "capture": {
      "type": "image",
      "transferMode": "binary",
      "mimeType": "image/png",
      "binaryRef": {
        "streamId": "550e8400-e29b-41d4-a716-446655440000",
        "size": 5242880
      }
    }
  },
  "id": 1
}

--mcp-boundary
Content-Type: image/png
Content-ID: 550e8400-e29b-41d4-a716-446655440000
Content-Length: 5242880

[Binary PNG Data]
--mcp-boundary--
```

## Benefits for Snagit Integration

### Before Binary Transfer
- Must resize 4K screenshots to 800x800 or smaller
- Loses critical detail for UI debugging
- Base64 overhead consumes valuable context
- Slower processing due to encoding/decoding

### After Binary Transfer  
- Send full-resolution screenshots (4K, 5K, or higher)
- Preserve all UI details for accurate analysis
- 33% more space for actual content
- Faster transfer and processing
- Better user experience

## Implementation Changes

### Snagit MCP Server (C#)
```csharp
public async Task<object> GetLastCapture(
    int maxWidth = 2048, 
    int maxHeight = 2048,
    string transferMode = "base64")
{
    var capture = await _snagitService.GetLastCaptureAsync();
    
    if (transferMode == "binary" && _binaryTransferSupported)
    {
        // No need to resize for context limits!
        var binaryRef = await _binaryManager.RegisterBinaryData(
            capture.ImageData,
            "image/png"
        );
        
        return new {
            capture = new {
                type = "image",
                transferMode = "binary",
                mimeType = "image/png",
                binaryRef = binaryRef,
                width = capture.Width,
                height = capture.Height,
                wasResized = false
            }
        };
    }
    else
    {
        // Fallback to base64 with resizing
        var processed = await _imageProcessor.ProcessImageAsync(
            capture.ImageData,
            maxWidth,
            maxHeight
        );
        
        return new {
            capture = new {
                type = "image",
                data = processed.Base64Data,
                mimeType = "image/png",
                width = processed.Width,
                height = processed.Height,
                wasResized = processed.WasResized,
                originalDimensions = processed.OriginalDimensions
            }
        };
    }
}
```

### Client Usage (Claude Desktop)
```typescript
// With binary transfer support
const result = await client.call("snagit/get-last-capture", {
  transferMode: "binary",
  maxWidth: 4096,
  maxHeight: 4096
});

if (result.capture.transferMode === "binary") {
  // Retrieve binary data
  const imageData = await client.getBinaryData(result.capture.binaryRef);
  // Use full-resolution image for analysis
}
```

## Performance Comparison

| Metric | Base64 (Current) | Binary Transfer | Improvement |
|--------|------------------|-----------------|-------------|
| Transfer Size | 6.99MB | 5MB | 28.6% smaller |
| Max Resolution | 800x800 | 4K+ | 5x+ more pixels |
| Processing Time | ~500ms | ~50ms | 10x faster |
| Memory Usage | 2x (encoded + decoded) | 1x | 50% less |

## Conclusion

Binary transfer support would dramatically improve the Snagit MCP server's ability to share high-quality screenshots with LLMs, enabling better UI analysis, documentation, and debugging workflows.