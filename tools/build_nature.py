"""Pack the KayKit Forest Nature Pack (CC0) glTF models into one compact binary for the web game.

Usage: python3 tools/build_nature.py <KayKit gltf folder> <output folder>

Output:
  nature.bin   all models back to back: int16 positions, int8 normals, uint16 uvs, uint16 indices
  nature.json  per model offsets, counts, quantization scale, footprint radius and height
  forest_texture.png  the shared color atlas

Axes are converted from glTF (y up, z toward viewer) to the game (x east, y north, z up).
"""
import json, os, struct, sys, shutil, math, glob

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

KEEP_PREFIX = ('Tree_', 'Bush_', 'Rock_', 'Grass_1_', 'Grass_2_')
SKIP_WORDS = ('Singlesided', 'SingleSided', '_Mesh')

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_accessor(g, buf, idx):
    a = g['accessors'][idx]
    bv = g['bufferViews'][a['bufferView']]
    fmt, size = COMP[a['componentType']]
    n = NCOMP[a['type']]
    stride = bv.get('byteStride', size * n)
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for i in range(a['count']):
        out.append(struct.unpack_from('<' + fmt * n, buf, base + i * stride))
    return out


def quat_rotate(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    tx = 2 * (y * vz - z * vy); ty = 2 * (z * vx - x * vz); tz = 2 * (x * vy - y * vx)
    return (vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx))


models, blob = [], bytearray()
for path in sorted(glob.glob(os.path.join(SRC, '*.gltf'))):
    name = os.path.basename(path)[:-5].replace('_Color1', '')
    if not name.startswith(KEEP_PREFIX) or any(w in name for w in SKIP_WORDS):
        continue
    g = json.load(open(path))
    buf = open(os.path.join(SRC, g['buffers'][0]['uri']), 'rb').read()
    node = next(n for n in g['nodes'] if 'mesh' in n)
    S = node.get('scale', [1, 1, 1]); Rq = node.get('rotation', [0, 0, 0, 1]); T = node.get('translation', [0, 0, 0])
    pos, nrm, uv, idx = [], [], [], []
    for prim in g['meshes'][node['mesh']]['primitives']:
        base = len(pos)
        P = read_accessor(g, buf, prim['attributes']['POSITION'])
        N = read_accessor(g, buf, prim['attributes']['NORMAL'])
        U = read_accessor(g, buf, prim['attributes']['TEXCOORD_0'])
        I = read_accessor(g, buf, prim['indices'])
        for p, n_, u in zip(P, N, U):
            p = quat_rotate(Rq, (p[0] * S[0], p[1] * S[1], p[2] * S[2]))
            p = (p[0] + T[0], p[1] + T[1], p[2] + T[2])
            n_ = quat_rotate(Rq, n_)
            pos.append((p[0], -p[2], p[1]))          # glTF (x, y up, z) -> game (x, y north, z up)
            nrm.append((n_[0], -n_[2], n_[1]))
            uv.append(u)
        idx += [i[0] + base for i in I]
    if len(pos) > 65535:
        continue
    q = max(max(abs(c) for c in p) for p in pos) / 32767.0
    zmax = max(p[2] for p in pos)
    canopy = [p for p in pos if p[2] > zmax * 0.45] or pos
    radius = max(math.hypot(p[0], p[1]) for p in canopy)
    base_r = max([math.hypot(p[0], p[1]) for p in pos if p[2] < zmax * 0.2] or [radius])
    off = len(blob)
    for p in pos:
        blob += struct.pack('<hhh', *[int(round(c / q)) for c in p])
    while len(blob) % 4: blob += b'\0'
    off_n = len(blob)
    for n_ in nrm:
        l = math.sqrt(sum(c * c for c in n_)) or 1
        blob += struct.pack('<bbb', *[int(round(c / l * 127)) for c in n_])
    while len(blob) % 4: blob += b'\0'
    off_u = len(blob)
    for u in uv:
        blob += struct.pack('<HH', *[max(0, min(65535, int(round(c * 65535)))) for c in u])
    off_i = len(blob)
    blob += struct.pack('<%dH' % len(idx), *idx)
    while len(blob) % 4: blob += b'\0'
    models.append(dict(name=name, verts=len(pos), indices=len(idx), q=q, pos=off, nrm=off_n, uv=off_u, idx=off_i,
                       radius=round(radius, 3), base=round(base_r, 3), height=round(zmax, 3)))

open(os.path.join(OUT, 'nature.bin'), 'wb').write(blob)
json.dump(dict(source='KayKit Forest Nature Pack 1.0 by Kay Lousberg (CC0)', models=models),
          open(os.path.join(OUT, 'nature.json'), 'w'), indent=0)
shutil.copy(os.path.join(SRC, 'forest_texture.png'), os.path.join(OUT, 'forest_texture.png'))
print(len(models), 'models,', len(blob), 'bytes')
for m in models:
    print('%-14s v%5d r%5.2f base%5.2f h%5.2f' % (m['name'], m['verts'], m['radius'], m['base'], m['height']))
