/**
 * Binary Transfer Extension for Model Context Protocol
 * 
 * This file extends the MCP schema to support efficient binary data transfer
 * without base64 encoding overhead.
 */

import { Request, Result, Notification } from './2025-03-26/schema';

/**
 * Binary transfer capability for client/server negotiation
 */
export interface BinaryTransferCapability {
  /**
   * Whether binary transfer is supported
   */
  supported: boolean;
  
  /**
   * Maximum size of binary data that can be transferred (in bytes)
   */
  maxBinarySize?: number;
  
  /**
   * Supported binary transfer modes
   */
  supportedModes: BinaryTransferMode[];
}

/**
 * Available binary transfer modes
 */
export type BinaryTransferMode = "stream" | "multipart" | "websocket-binary";

/**
 * Reference to binary data that will be transferred separately
 */
export interface BinaryReference {
  /**
   * Unique identifier for this binary stream
   */
  streamId: string;
  
  /**
   * Size of the binary data in bytes
   */
  size: number;
  
  /**
   * Optional SHA-256 checksum for verification
   */
  checksum?: string;
  
  /**
   * MIME type of the binary data
   */
  mimeType: string;
}

/**
 * Extended content type that supports both base64 and binary transfer
 */
export interface BinaryTransferContent {
  type: "image" | "audio" | "blob";
  
  /**
   * Transfer mode for this content
   * @default "base64"
   */
  transferMode?: "base64" | "binary";
  
  /**
   * MIME type of the content
   */
  mimeType: string;
  
  /**
   * Base64-encoded data (when transferMode is "base64" or omitted)
   */
  data?: string;
  
  /**
   * Reference to binary data (when transferMode is "binary")
   */
  binaryRef?: BinaryReference;
}

/**
 * Request to initiate a binary transfer
 */
export interface BinaryTransferRequest extends Request {
  method: "binary/transfer";
  params: {
    /**
     * The binary reference from a previous response
     */
    binaryRef: BinaryReference;
    
    /**
     * Optional byte range for partial transfers
     */
    range?: {
      start: number;
      end?: number;
    };
  };
}

/**
 * Response indicating binary data will follow
 */
export interface BinaryTransferResult extends Result {
  /**
   * Confirmation that binary data will be sent
   */
  streamId: string;
  
  /**
   * Actual size that will be transferred (may differ for partial transfers)
   */
  size: number;
  
  /**
   * Transfer will begin after this response
   */
  ready: boolean;
}

/**
 * Notification for binary transfer progress
 */
export interface BinaryTransferProgressNotification extends Notification {
  method: "notifications/binary/progress";
  params: {
    streamId: string;
    bytesTransferred: number;
    totalBytes: number;
    complete: boolean;
  };
}

/**
 * Extended resource contents that support binary transfer
 */
export interface BinaryResourceContents {
  /**
   * The URI of the resource
   */
  uri: string;
  
  /**
   * MIME type of the resource, if known
   */
  mimeType?: string;
  
  /**
   * For text resources
   */
  text?: string;
  
  /**
   * For base64-encoded binary resources (backward compatible)
   */
  blob?: string;
  
  /**
   * For binary transfer mode
   */
  binaryRef?: BinaryReference;
}

/**
 * Binary stream header format (for stream mode)
 */
export interface BinaryStreamHeader {
  /**
   * Magic bytes to identify MCP binary stream: "MCP\0"
   */
  magic: [0x4D, 0x43, 0x50, 0x00];
  
  /**
   * Protocol version (1 for initial version)
   */
  version: number;
  
  /**
   * Stream ID (16 bytes UUID)
   */
  streamId: Uint8Array;
  
  /**
   * Size of the following binary data (8 bytes, little-endian)
   */
  size: bigint;
  
  /**
   * Optional flags for future extensions
   */
  flags?: number;
}

/**
 * Helper type for content that can be transferred in binary mode
 */
export type BinaryCapableContent = 
  | ImageContentWithBinary
  | AudioContentWithBinary
  | BlobContentWithBinary;

export interface ImageContentWithBinary extends BinaryTransferContent {
  type: "image";
}

export interface AudioContentWithBinary extends BinaryTransferContent {
  type: "audio";
}

export interface BlobContentWithBinary extends BinaryTransferContent {
  type: "blob";
}

/**
 * Utility function to check if content uses binary transfer
 */
export function isBinaryTransfer(content: BinaryTransferContent): boolean {
  return content.transferMode === "binary" && content.binaryRef !== undefined;
}

/**
 * Utility function to calculate base64 overhead
 */
export function calculateBase64Overhead(binarySize: number): number {
  // Base64 encoding increases size by approximately 4/3
  return Math.ceil(binarySize * 4 / 3) - binarySize;
}