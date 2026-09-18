/**
 * The energy inside the cell: a vertical electric-blue → white field whose height is
 * the charge, flowing upward, faster as the charge rises, white-hot for a
 * moment at 100 %. Controlled electricity inside engineered hardware —
 * no lightning.
 */
export const chargeVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const chargeFragment = /* glsl */ `
  uniform float uCharge;
  uniform float uTime;
  uniform float uFlash;
  uniform float uSpeed;
  uniform float uPulse;
  uniform vec3 uRed;
  uniform vec3 uDeep;
  uniform vec3 uWhite;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float y = vUv.y;
    float t = uTime * uSpeed;
    // Seamless around the cylinder: sample on a circle in x.
    float ang = vUv.x * 6.2831853;
    vec2 cx = vec2(cos(ang), sin(ang));
    float n1 = noise(vec2(cx.x * 2.2 + 3.0, y * 3.2 - t * 0.35) + cx.y * 0.9);
    float n2 = noise(vec2(cx.x * 5.5 + 7.0, y * 9.0 - t * 0.85) + cx.y * 2.1);
    float n = n1 * 0.65 + n2 * 0.35;

    float level = uCharge + (n - 0.5) * 0.022;
    float fill = (1.0 - smoothstep(level - 0.006, level + 0.006, y)) * smoothstep(0.0, 0.01, uCharge);

    float rise = smoothstep(0.0, 1.0, y / max(level, 0.02));
    // Filaments: two families of thin arcs, warped by the noise, drifting upward.
    float streak = pow(max(0.0, sin(ang * 9.0 + n2 * 5.0 + t * 0.4)), 22.0);
    streak += 0.55 * pow(max(0.0, sin(ang * 17.0 - n1 * 7.0 - t * 0.9)), 34.0);
    vec3 body = mix(uDeep, uRed, 0.12 + 0.88 * rise) * 1.12;
    body += uWhite * streak * (0.12 + 0.5 * rise) * (0.5 + 0.5 * n1);
    float band = smoothstep(level - 0.06, level - 0.004, y) * smoothstep(0.0, 0.02, uCharge);
    body = mix(body, uWhite * 1.5, band * 0.8);

    vec3 cavity = mix(vec3(0.012, 0.012, 0.016), uDeep * 0.22, 0.08 + 0.25 * n1);
    vec3 col = mix(cavity, body, fill);

    col *= 1.0 + uPulse * 0.22 * (0.5 + 0.5 * sin(uTime * 7.0));

    float fres = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vViewDir))), 3.0);
    col += fres * mix(uDeep, uRed, fill) * 0.4;

    col = mix(col, uWhite * 1.35, uFlash);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
