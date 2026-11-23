// The tools every part of the garden scene is built with: flat materials, a quick way to stand a
// shape somewhere, the one supply of made-up numbers, and the wind as the graphics card reads it.

import * as THREE from 'three';

import { seeded } from './ground';

/**
 * How much the garden draws. A computer gets all of it. A phone gets about half the leaves and
 * grass, softer shadows and fewer dots to the screen, which is the design's advice for small
 * devices. It has not been timed on a phone yet.
 */
export type Quality = {
  /** One leaf in this many is drawn. Those that are drawn are made this much bigger, to keep the trees full. */
  leafEvery: number;
  leafScale: number;
  /** How many tufts of grass are tried for, and how much wider each is. */
  tufts: number;
  tuftScale: number;
  shadowMap: number;
  /** The most screen dots drawn for each dot of layout. */
  pixelRatio: number;
};

export const QUALITY: Record<'full' | 'light', Quality> = {
  full: { leafEvery: 1, leafScale: 1, tufts: 27000, tuftScale: 1, shadowMap: 2048, pixelRatio: 2 },
  light: { leafEvery: 2, leafScale: 1.3, tufts: 13000, tuftScale: 1.3, shadowMap: 1024, pixelRatio: 1.5 },
};

/** A material whose colour can be set, which is all of the ones the garden uses. */
export type Paint = THREE.Material & { color: THREE.Color };

/** A material's program, as it is handed over to be changed before it is first used. */
export type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];

/** The same wind as `wind` in ground.ts, written for the graphics card. The two must be kept alike. */
const WIND_GLSL = 'float gWind(vec2 p,float t){return sin(t*1.15+p.x*.7+p.y*.45)*.6+sin(t*2.4+p.x*1.4-p.y*.3)*.25+pow(max(0.,sin(t*.23+p.x*.2)),6.)*.8;}\n';

export type Kit = ReturnType<typeof makeKit>;

export function makeKit(world: THREE.Scene, quality: Quality) {
  const rand = seeded();
  /** Everything out of doors hangs from this, so it can all be put away while the camera is inside the house. */
  const scene = new THREE.Group();
  world.add(scene);
  /** The clock, how strong the wind is, and where the flowers stand, as the grass and leaves are told them each frame. */
  const time = { value: 0 };
  const windAmp = { value: 1 };
  const flowerSpots = { value: Array.from({ length: 16 }, () => new THREE.Vector3()) };
  /** How much of spring (x), autumn (y) and winter (z) is showing, each from 0 to 1. All zero is summer. */
  const season = { value: new THREE.Vector4() };
  /** The lawn: how tall its blades stand (x), how much the mowing stripes show (y) and how far the wildflowers are up (z). */
  const lawnStyle = { value: new THREE.Vector3(1, 0, 0) };

  const lambert = (color: string, more?: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial({ color, ...more });
  const basic = (color: string, more?: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ color, ...more });

  return {
    /** The whole scene: the lights, the sky's colour and the haze belong to it, and so does the inside of the house. */
    world,
    scene,
    quality,
    /** The next made-up number from 0 to 1. Always the same run of them, so the garden is the same every time. */
    rand,
    /** The next made-up number between two others. */
    between: (a: number, b: number) => a + rand() * (b - a),
    time,
    windAmp,
    flowerSpots,
    season,
    lawnStyle,
    /** A flat-coloured material that takes light and shade. Nothing is glossy, so brand colours stay true. */
    lambert,
    /** A material that is its colour whatever the light. */
    basic,
    /** A ball one unit across each way, stretched into petals, leaves, clouds and more. */
    ball: new THREE.SphereGeometry(1, 18, 12),
    /** Every material that takes the time of day's foliage tint. */
    tinted: [] as Paint[],
    /** A shape, stood somewhere. It casts a shadow unless told not to. */
    mesh<G extends THREE.BufferGeometry, M extends THREE.Material | THREE.Material[]>(geometry: G, material: M, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh<G, M> {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      return m;
    },
    /** Puts one thing inside another and hands it back, to go on shaping it. */
    add<T extends THREE.Object3D>(parent: THREE.Object3D, child: T): T {
      parent.add(child);
      return child;
    },
    /** A small picture painted in code, to wrap round a shape. */
    painted(width: number, height: number, draw: (pen: CanvasRenderingContext2D, width: number, height: number) => void): THREE.CanvasTexture {
      const picture = document.createElement('canvas');
      picture.width = width;
      picture.height = height;
      const pen = picture.getContext('2d');
      if (pen) draw(pen, width, height);
      const texture = new THREE.CanvasTexture(picture);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    },
    /**
     * Changes how a material's points are placed, for leaves and grass that sway. `head` is what
     * the change needs declared, `swaps` are pieces of the usual program to replace, and `body`
     * moves the point once it is in the world. Leaves and blades are lit by a shaped normal, so the
     * flip for a back face is undone unless `keepNormal` says the shape is solid.
     */
    sway(material: THREE.Material, head: string, swaps: [string, string][], body: string, keepNormal = false) {
      // Two materials changed in different ways must not be handed the same finished program.
      material.customProgramCacheKey = () => head + swaps.map(([, to]) => to).join('') + body;
      material.onBeforeCompile = (shader: Shader) => {
        shader.uniforms.uT = time;
        shader.uniforms.uA = windAmp;
        shader.uniforms.uF = flowerSpots;
        shader.uniforms.uSe = season;
        shader.uniforms.uLawn = lawnStyle;
        let vertex = shader.vertexShader;
        for (const [from, to] of swaps) vertex = vertex.replace(from, to);
        vertex = vertex.replace(
          '#include <project_vertex>',
          'vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nmvPosition = instanceMatrix * mvPosition;\n#endif\n' +
            body +
            '\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;',
        );
        shader.vertexShader = head + WIND_GLSL + vertex;
        if (!keepNormal) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );');
      };
    },
  };
}
