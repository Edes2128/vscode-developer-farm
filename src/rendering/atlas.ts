import { ImageSource, Rectangle, Texture } from 'pixi.js';

export interface AtlasFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The manifest the art pipeline writes next to the atlas image (scripts/build-assets.mjs). */
export interface AtlasManifest {
  readonly version: number;
  readonly image: string;
  readonly size: { readonly w: number; readonly h: number };
  readonly tileSize: number;
  readonly frames: Readonly<Record<string, AtlasFrame>>;
}

/** The sprite atlas: one image, many named frames. Every texture is created once and shared. */
export class Atlas {
  private readonly textures = new Map<string, Texture>();

  private constructor(manifest: AtlasManifest, source: ImageSource) {
    for (const [name, f] of Object.entries(manifest.frames)) {
      this.textures.set(name, new Texture({ source, frame: new Rectangle(f.x, f.y, f.w, f.h), label: name }));
    }
  }

  /**
   * Loads the atlas image. The image is read through a plain `<img>` element, so no `fetch` or worker is
   * involved: that is all the webview's content security policy allows.
   */
  static async load(imageUrl: string, manifest: AtlasManifest): Promise<Atlas> {
    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;
    try {
      await image.decode();
    } catch (error) {
      throw new Error(`The sprite atlas could not be loaded from ${imageUrl}: ${String(error)}`);
    }
    // Crisp pixels: never smooth, never wrap, no mipmaps.
    const source = new ImageSource({ resource: image, scaleMode: 'nearest', addressMode: 'clamp-to-edge', autoGenerateMipmaps: false });
    return new Atlas(manifest, source);
  }

  has(name: string): boolean {
    return this.textures.has(name);
  }

  texture(name: string): Texture {
    const texture = this.textures.get(name);
    if (texture === undefined) throw new Error(`The atlas has no frame "${name}"`);
    return texture;
  }

  /** Frees the textures. The atlas must not be used afterwards. */
  destroy(): void {
    for (const texture of this.textures.values()) texture.destroy(false);
    this.textures.clear();
  }
}
