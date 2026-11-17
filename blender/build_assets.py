"""
NOITE CRITICA - pipeline de assets (Blender 5.x, headless)

Uso:
    pip install bpy            # ou: blender -b -P blender/build_assets.py
    python3 blender/build_assets.py

Gera em public/assets/:
    kid_<id>.glb   (6 personagens, hierarquia body/head/armL/armR/legL/legR para animacao procedural)
    exterior.glb   (Fase 1 - jardim e fachada)
    hall.glb       (Fase 2 - hall, estados "casa" e "masmorra")

CONTRATO DE NOMES (lido pela engine web e pelos scripts Unity):
    hs_<id>     hotspot clicavel (o no e todos os filhos)
    st_<id>     objeto de estado, ligado/desligado pelas regras do capitulo
    win_*       vidracas (a engine acende/apaga)
    glow_*      malhas emissivas animadas pela engine
    house_* / dung_*   conjuntos do hall antes/depois da transformacao
Convencao de eixos no Blender: X direita, Y fundo (longe da camera), Z cima.
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets")
os.makedirs(OUT, exist_ok=True)
MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(hexcol, emit=0.0, rough=0.9, metal=0.0):
    key = (hexcol, emit, rough, metal)
    if key in MATS:
        return MATS[key]
    h = hexcol.lstrip("#")
    rgb = tuple(lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    m = bpy.data.materials.new("m_%s_%d" % (h, len(MATS)))
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    MATS[key] = m
    return m


def _finish(name, bm, col, loc, rot, parent, smooth, **mk):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    me.materials.append(mat(col, **mk))
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location, o.rotation_euler, o.parent = loc, rot, parent
    return o


def box(name, size, loc, col, parent=None, rot=(0, 0, 0), pivot=(0, 0, 0), **mk):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.translate(bm, vec=pivot, verts=bm.verts)
    return _finish(name, bm, col, loc, rot, parent, False, **mk)


def cyl(name, r, h, loc, col, parent=None, rot=(0, 0, 0), r2=None, seg=12, pivot=(0, 0, 0),
        scale=(1, 1, 1), smooth=True, **mk):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r,
                          radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    bmesh.ops.translate(bm, vec=pivot, verts=bm.verts)
    return _finish(name, bm, col, loc, rot, parent, smooth and seg > 6, **mk)


def sph(name, r, loc, col, parent=None, scale=(1, 1, 1), pivot=(0, 0, 0), rot=(0, 0, 0), seg=14, **mk):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    bmesh.ops.translate(bm, vec=pivot, verts=bm.verts)
    return _finish(name, bm, col, loc, rot, parent, True, **mk)


def ico(name, r, loc, col, parent=None, **mk):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    return _finish(name, bm, col, loc, (0, 0, 0), parent, False, **mk)


def empty(name, loc=(0, 0, 0), parent=None, rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.location, o.rotation_euler, o.parent = loc, rot, parent
    return o


def export(fname):
    path = os.path.join(OUT, fname)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True,
                              export_apply=False, export_animations=False)
    print("OK", fname, os.path.getsize(path) // 1024, "KB")


R = math.radians

# ----------------------------------------------------------------------------- personagens

KIDS = {
    "bia":   dict(skin="#c98d62", hair="#3a2418", top="#f2efe6", legs="#f2efe6", shoe="#b23a3a", w=1.0),
    "caio":  dict(skin="#e8b98f", hair="#1c1c22", top="#2a2d3a", legs="#1d1f29", shoe="#111111", w=0.92),
    "tomas": dict(skin="#f0c8a0", hair="#b5651d", top="#3b6fb5", legs="#4a4f5c", shoe="#5a3b22", w=1.25),
    "iris":  dict(skin="#8a5a3c", hair="#16121c", top="#4a3a9c", legs="#4a3a9c", shoe="#2a2140", w=0.95),
    "leo":   dict(skin="#f2d0b0", hair="#d9a441", top="#c0392b", legs="#3d2b1f", shoe="#2b1b10", w=1.0),
    "nina":  dict(skin="#b97a50", hair="#5a2d16", top="#3f7d3a", legs="#5b4630", shoe="#3a2a1a", w=0.95),
}


def build_kid(kid):
    reset()
    k = KIDS[kid]
    w = k["w"]
    root = empty("kid_" + kid)
    body = empty("body", (0, 0, 0.40), root)
    box("torso", (0.36 * w, 0.24 * w, 0.42), (0, 0, 0), k["top"], body, pivot=(0, 0, 0.21))
    head = empty("head", (0, 0, 0.44), body)
    sph("skull", 0.20, (0, 0, 0.19), k["skin"], head, scale=(1, 0.95, 1))
    for sx in (-1, 1):
        sph("eye", 0.028, (sx * 0.075, -0.175, 0.21), "#15151a", head, seg=8, rough=0.3)
    box("mouth", (0.07, 0.01, 0.015), (0, -0.19, 0.12), "#7a3030", head)
    arms = {}
    for sx, n in ((-1, "armL"), (1, "armR")):
        a = empty(n, (sx * (0.18 * w + 0.06), 0, 0.39), body)
        box("sleeve", (0.11, 0.12, 0.22), (0, 0, 0), k["top"], a, pivot=(0, 0, -0.10))
        box("hand", (0.09, 0.10, 0.13), (0, 0, -0.26), k["skin"], a)
        arms[n] = a
    for sx, n in ((-1, "legL"), (1, "legR")):
        l = empty(n, (sx * 0.09 * w, 0, 0.40), root)
        box("leg", (0.13, 0.14, 0.32), (0, 0, 0), k["legs"], l, pivot=(0, 0, -0.16))
        box("shoe", (0.14, 0.22, 0.09), (0, -0.03, -0.355), k["shoe"], l)
    hair = lambda s=(1.06, 1.05, 1.0), off=(0, 0.035, 0.225): sph("hair", 0.20, off, k["hair"], head, scale=s)

    if kid == "bia":      # Curandeira: jaleco, touca e maleta de primeiros socorros
        hair()
        for sx in (-1, 1):
            sph("bun", 0.07, (sx * 0.19, 0.04, 0.30), k["hair"], head, seg=8)
        box("cap", (0.26, 0.14, 0.10), (0, -0.06, 0.40), "#ffffff", head)
        box("capx1", (0.09, 0.01, 0.03), (0, -0.135, 0.40), "#d63031", head)
        box("capx2", (0.03, 0.01, 0.09), (0, -0.135, 0.40), "#d63031", head)
        box("coat", (0.40, 0.26, 0.20), (0, 0, -0.06), "#f2efe6", body)
        box("x1", (0.14, 0.01, 0.045), (0, -0.125, 0.26), "#d63031", body)
        box("x2", (0.045, 0.01, 0.14), (0, -0.125, 0.26), "#d63031", body)
        box("kit", (0.20, 0.09, 0.15), (0.05, 0, -0.36), "#d63031", arms["armR"])
        box("kitx", (0.08, 0.10, 0.03), (0.05, 0, -0.36), "#ffffff", arms["armR"])
    elif kid == "caio":   # Ladino: capuz, mascara e gazuas
        sph("hood", 0.225, (0, 0.03, 0.20), "#2a2d3a", head, scale=(1.05, 1.05, 1.05))
        cyl("hoodtip", 0.09, 0.2, (0, 0.14, 0.36), "#2a2d3a", head, r2=0.0, rot=(R(-50), 0, 0), seg=8)
        box("mask", (0.36, 0.05, 0.075), (0, -0.165, 0.21), "#0c0c10", head)
        for sx in (-1, 1):
            sph("eyew", 0.03, (sx * 0.075, -0.19, 0.21), "#f5f5f5", head, seg=8)
        box("belt", (0.38, 0.26, 0.05), (0, 0, 0.03), "#6b4a2a", body)
        box("pouch", (0.10, 0.06, 0.10), (0.12, -0.14, 0.0), "#8a6238", body)
        cyl("ringk", 0.045, 0.01, (0, -0.02, -0.34), "#c9a227", arms["armR"], rot=(R(90), 0, 0), metal=0.8, rough=0.4)
        box("pick", (0.012, 0.012, 0.16), (0.02, -0.02, -0.43), "#b0b4bc", arms["armR"], metal=0.8, rough=0.4)
    elif kid == "tomas":  # Cavaleiro: armadura de papelao, balde, espada e tampa de panela
        hair((1.03, 1.02, 0.95))
        cyl("bucket", 0.215, 0.20, (0, 0.0, 0.335), "#9aa3ad", head, r2=0.185, metal=0.6, rough=0.45)
        box("plume", (0.04, 0.22, 0.14), (0, 0.02, 0.49), "#d63031", head)
        box("armor", (0.50, 0.33, 0.34), (0, 0, 0.22), "#c2a06a", body)
        box("armx1", (0.20, 0.01, 0.05), (0, -0.17, 0.25), "#2f5fa8", body)
        box("armx2", (0.05, 0.01, 0.20), (0, -0.17, 0.25), "#2f5fa8", body)
        for sx in (-1, 1):
            box("pauldron", (0.17, 0.20, 0.08), (sx * 0.30, 0, 0.40), "#c2a06a", body)
        box("blade", (0.05, 0.02, 0.50), (0, -0.10, -0.12), "#cfd6dd", arms["armR"], rot=(R(70), 0, 0), metal=0.5, rough=0.4)
        box("guard", (0.18, 0.04, 0.04), (0, -0.07, -0.28), "#8a6238", arms["armR"], rot=(R(70), 0, 0))
        cyl("shield", 0.20, 0.03, (-0.08, -0.02, -0.18), "#aeb6bf", arms["armL"], rot=(0, R(90), 0), metal=0.7, rough=0.35, seg=16)
        sph("boss", 0.04, (-0.10, -0.02, -0.18), "#22252b", arms["armL"], seg=8)
    elif kid == "iris":   # Maga: chapeu pontudo, manto, oculos e varinha-estrelinha
        hair((1.08, 1.08, 1.0))
        cyl("brim", 0.30, 0.025, (0, 0, 0.36), "#3a2d80", head, seg=16)
        cyl("hat", 0.19, 0.42, (0, 0.03, 0.57), "#3a2d80", head, r2=0.0, rot=(R(-12), 0, 0), seg=12)
        for i, (a, z) in enumerate(((0.3, 0.45), (2.2, 0.55), (4.1, 0.50), (5.4, 0.66))):
            rr = 0.19 * (1 - (z - 0.36) / 0.42) + 0.012
            sph("star", 0.022, (math.sin(a) * rr, -math.cos(a) * rr * 0.9 + 0.02, z), "#ffd84a", head, seg=6, emit=1.5)
        for sx in (-1, 1):
            cyl("lens", 0.055, 0.012, (sx * 0.075, -0.19, 0.21), "#d9f2ff", head, rot=(R(90), 0, 0), rough=0.1)
        cyl("robe", 0.20, 0.36, (0, 0, -0.17), "#4a3a9c", body, r2=0.30, rot=(R(180), 0, 0), seg=10)
        box("sash", (0.38, 0.26, 0.05), (0, 0, 0.04), "#ffd84a", body)
        cyl("wand", 0.012, 0.36, (0, -0.10, -0.24), "#3b2a1a", arms["armR"], rot=(R(60), 0, 0), seg=6)
        sph("glow_wand", 0.035, (0, -0.26, -0.15), "#fff3a0", arms["armR"], seg=8, emit=3)
    elif kid == "leo":    # Bardo: chapeu de pena, capa e teclado de brinquedo
        hair((1.07, 1.06, 1.0))
        cyl("hatb", 0.27, 0.03, (0, 0, 0.35), "#2e6b4f", head, seg=16)
        cyl("hatt", 0.17, 0.11, (0, 0, 0.41), "#2e6b4f", head, r2=0.14)
        box("feather", (0.03, 0.26, 0.09), (0.13, 0.08, 0.50), "#f1c40f", head, rot=(R(25), 0, R(15)))
        box("cape", (0.42, 0.03, 0.50), (0, 0.15, 0.10), "#8e1f18", body, rot=(R(-8), 0, 0))
        box("collar", (0.40, 0.28, 0.05), (0, 0, 0.40), "#f1c40f", body)
        box("keytar", (0.46, 0.05, 0.13), (0.02, -0.16, 0.14), "#f5f5f5", body, rot=(0, R(-22), 0))
        box("keys", (0.36, 0.01, 0.05), (0.02, -0.19, 0.13), "#15151a", body, rot=(0, R(-22), 0))
        box("neck", (0.20, 0.035, 0.05), (0.30, -0.16, 0.28), "#c0392b", body, rot=(0, R(-22), 0))
    elif kid == "nina":   # Patrulheira: capuz verde, capa, trancas e estilingue
        hair()
        for sx in (-1, 1):
            cyl("braid", 0.04, 0.24, (sx * 0.17, -0.02, 0.05), k["hair"], head, seg=6)
        sph("hood", 0.225, (0, 0.05, 0.215), "#2f6130", head, scale=(1.05, 1.0, 1.02))
        box("cloak", (0.44, 0.03, 0.46), (0, 0.15, 0.12), "#2f6130", body, rot=(R(-8), 0, 0))
        box("strap", (0.05, 0.26, 0.48), (0, 0, 0.21), "#6b4a2a", body, rot=(0, R(38), 0))
        box("sling1", (0.025, 0.025, 0.14), (0, -0.03, -0.36), "#7a5230", arms["armR"])
        box("sling2", (0.025, 0.025, 0.11), (-0.04, -0.03, -0.46), "#7a5230", arms["armR"], rot=(0, R(-30), 0))
        box("sling3", (0.025, 0.025, 0.11), (0.04, -0.03, -0.46), "#7a5230", arms["armR"], rot=(0, R(30), 0))
        cyl("bino", 0.04, 0.09, (0, -0.15, 0.27), "#22252b", body, rot=(R(90), 0, 0), seg=8)
    export("kid_%s.glb" % kid)


# ----------------------------------------------------------------------------- emblemas das classes

GOLD = dict(metal=0.3, rough=0.4, emit=1.6)


def emblem(kind, parent, loc, s=1.0, col="#e2b93b", rot=(0, 0, 0), name=None):
    e = empty(name or ("emb_" + kind), loc, parent, rot)
    e.scale = (s, s, s)
    t = 0.05
    if kind == "bia":      # cruz
        box("e", (0.16, t, 0.52), (0, 0, 0), col, e, **GOLD)
        box("e", (0.52, t, 0.16), (0, 0, 0), col, e, **GOLD)
    elif kind == "caio":   # chave
        cyl("e", 0.15, t, (0, 0, 0.18), col, e, rot=(R(90), 0, 0), seg=12, **GOLD)
        cyl("e", 0.07, t * 1.2, (0, 0, 0.18), "#1a1410", e, rot=(R(90), 0, 0), seg=10)
        box("e", (0.07, t, 0.40), (0, 0, -0.10), col, e, **GOLD)
        box("e", (0.14, t, 0.06), (0.08, 0, -0.26), col, e, **GOLD)
        box("e", (0.10, t, 0.06), (0.06, 0, -0.14), col, e, **GOLD)
    elif kind == "tomas":  # espada
        box("e", (0.09, t, 0.44), (0, 0, 0.06), col, e, **GOLD)
        box("e", (0.30, t, 0.07), (0, 0, -0.16), col, e, **GOLD)
        box("e", (0.07, t, 0.12), (0, 0, -0.25), col, e, **GOLD)
    elif kind == "iris":   # estrela
        for a in (0, 180):
            cyl("e", 0.27, t, (0, 0, 0), col, e, rot=(R(90), R(a), 0), seg=3, smooth=False, **GOLD)
    elif kind == "leo":    # nota musical
        sph("e", 0.12, (-0.07, 0, -0.17), col, e, scale=(1.2, 0.3, 0.9), seg=10, **GOLD)
        box("e", (0.05, t, 0.42), (0.05, 0, 0.03), col, e, **GOLD)
        box("e", (0.18, t, 0.09), (0.13, 0, 0.20), col, e, rot=(0, R(25), 0), **GOLD)
    elif kind == "nina":   # flecha
        box("e", (0.06, t, 0.42), (0, 0, -0.04), col, e, **GOLD)
        cyl("e", 0.15, t, (0, 0, 0.21), col, e, rot=(R(90), 0, 0), seg=3, smooth=False, **GOLD)
        for sx in (-1, 1):
            box("e", (0.14, t, 0.05), (sx * 0.06, 0, -0.24), col, e, rot=(0, R(sx * 40), 0), **GOLD)
    return e


# ----------------------------------------------------------------------------- Fase 1: exterior

def window(i, x, z, y, w=1.0, h=1.6, parent=None):
    box("winframe", (w + 0.25, 0.12, h + 0.25), (x, y, z), "#1b1622", parent)
    box("win_%d" % i, (w, 0.14, h), (x, y - 0.02, z), "#0b0d14", parent, rough=0.2)
    box("mullv", (0.07, 0.17, h), (x, y - 0.03, z), "#1b1622", parent)
    box("mullh", (w, 0.17, 0.07), (x, y - 0.03, z + 0.1), "#1b1622", parent)
    box("sill", (w + 0.4, 0.25, 0.1), (x, y - 0.05, z - h / 2 - 0.12), "#3a3346", parent)


def pumpkin(name, loc, parent=None, s=1.0, lit=None):
    p = empty(name, loc, parent)
    p.scale = (s, s, s)
    sph("pk", 0.30, (0, 0, 0.24), "#d9691e", p, scale=(1.15, 1.1, 0.85), seg=12)
    cyl("stem", 0.04, 0.10, (0, 0, 0.52), "#4c6b2c", p, seg=6)
    faces = [("st_dark" + lit, "#1a0d05", 0), ("st_flame" + lit, "#ffc94a", 4)] if lit else [("face", "#ffc94a", 3)]
    for fname, col, em in faces:
        f = empty(fname, (0, 0, 0), p)
        mk = dict(emit=em) if em else {}
        for sx in (-1, 1):
            cyl("eye", 0.065, 0.05, (sx * 0.12, -0.305, 0.30), col, f, rot=(R(90), R(180), 0), seg=3, smooth=False, **mk)
        box("mouth", (0.24, 0.05, 0.05), (0, -0.325, 0.15), col, f, **mk)
        for tx in (-0.07, 0.07):
            box("tooth", (0.045, 0.055, 0.045), (tx, -0.325, 0.185), col, f, **mk)
    return p


def fence_run(x0, y0, x1, y1, n, parent=None):
    d = Vector((x1 - x0, y1 - y0, 0))
    ang = math.atan2(d.y, d.x)
    box("rail", (d.length, 0.06, 0.06), ((x0 + x1) / 2, (y0 + y1) / 2, 1.25), "#15131a", parent, rot=(0, 0, ang))
    box("rail", (d.length, 0.06, 0.06), ((x0 + x1) / 2, (y0 + y1) / 2, 0.35), "#15131a", parent, rot=(0, 0, ang))
    for i in range(n + 1):
        t = i / n
        x, y = x0 + d.x * t, y0 + d.y * t
        cyl("bar", 0.03, 1.5, (x, y, 0.75), "#15131a", parent, seg=5)
        cyl("tip", 0.055, 0.16, (x, y, 1.57), "#15131a", parent, r2=0.0, seg=5)


def build_exterior():
    reset()
    random.seed(7)
    wall, wall2, trim, roof = "#3b3350", "#322b45", "#221c2e", "#191522"
    cyl("ground", 46, 0.2, (0, 6, -0.1), "#1c2b2a", seg=40, smooth=False)
    for i in range(7):        # caminho de pedras
        box("slab", (1.3 + random.random() * 0.3, 0.8, 0.06), (random.uniform(-0.2, 0.2), 0.2 + i * 1.0, 0.03),
            "#4a4a58", rot=(0, 0, random.uniform(-0.15, 0.15)))
    # --- mansao
    m = empty("mansion")
    box("block", (16, 7, 7), (0.5, 13.5, 3.5), wall, m)
    box("base", (16.3, 7.3, 0.6), (0.5, 13.5, 0.3), trim, m)
    box("belt", (16.2, 7.2, 0.18), (0.5, 13.5, 3.75), trim, m)
    box("cornice", (16.6, 7.6, 0.3), (0.5, 13.5, 7.1), trim, m)
    cyl("roof", 6.4, 3.2, (0.5, 13.5, 8.8), roof, m, r2=1.6, seg=4, rot=(0, 0, R(45)), scale=(1.82, 0.85, 1), smooth=False)
    box("tower", (4, 4, 11.5), (-6.8, 11.2, 5.75), wall2, m)
    box("towertrim", (4.3, 4.3, 0.3), (-6.8, 11.2, 11.5), trim, m)
    cyl("towerroof", 3.3, 4.6, (-6.8, 11.2, 13.9), roof, m, r2=0.0, seg=4, rot=(0, 0, R(45)), smooth=False)
    cyl("vane", 0.03, 1.0, (-6.8, 11.2, 16.6), "#0d0b12", m, seg=5)
    box("vane2", (0.7, 0.04, 0.22), (-6.8, 11.2, 16.9), "#0d0b12", m, rot=(0, 0, R(20)))
    box("chimney", (1.1, 1.1, 3.2), (5.2, 13.5, 10.2), wall2, m)
    box("gablew", (4.6, 0.5, 2.6), (0, 9.9, 8.1), wall2, m)
    cyl("gableroof", 3.0, 1.9, (0, 10.2, 10.3), roof, m, r2=0.0, seg=4, rot=(0, 0, R(45)), scale=(1.15, 0.5, 1), smooth=False)
    cyl("win_attic", 0.6, 0.14, (0, 9.62, 8.2), "#0b0d14", m, rot=(R(90), 0, 0), seg=16, rough=0.2)
    cyl("atticframe", 0.75, 0.10, (0, 9.68, 8.2), trim, m, rot=(R(90), 0, 0), seg=16)
    wi = 0
    for x in (-3.6, 3.6, 6.6):
        window(wi, x, 2.3, 9.98, parent=m); wi += 1
    for x in (-3.6, 0, 3.6, 6.6):
        window(wi, x, 5.4, 9.98, parent=m); wi += 1
    for z in (2.6, 5.9, 9.2):
        window(wi, -6.8, z, 9.18, w=0.9, h=1.5, parent=m); wi += 1
    for x, z, a in ((3.05, 2.3, 12), (-4.2, 5.4, -8), (7.2, 5.4, 6)):   # venezianas tortas
        box("shutter", (0.5, 0.06, 1.7), (x, 9.9, z), "#2a3a2e", m, rot=(0, R(a), 0))
    # --- varanda e porta
    box("porch", (5.4, 2.4, 0.5), (0, 8.8, 0.25), "#2b2433", m)
    box("step1", (4.2, 0.5, 0.33), (0, 7.35, 0.165), "#332b3d", m)
    box("step2", (4.6, 0.5, 0.16), (0, 6.85, 0.08), "#3a3246", m)
    for sx in (-1, 1):
        cyl("col", 0.17, 3.0, (sx * 2.35, 7.9, 2.0), "#4a4160", m, seg=10)
        box("colbase", (0.5, 0.5, 0.2), (sx * 2.35, 7.9, 0.6), trim, m)
    box("porchroof", (5.8, 2.9, 0.25), (0, 8.75, 3.6), trim, m)
    cyl("porchgable", 2.9, 0.9, (0, 8.75, 4.15), roof, m, r2=0.0, seg=4, rot=(0, 0, R(45)), scale=(1.4, 0.72, 1), smooth=False)
    box("doorframe", (2.0, 0.2, 3.0), (0, 9.95, 1.95), trim, m)
    door = empty("hs_door", (0, 9.85, 0.5))
    dc = empty("st_door_closed", (0, 0, 0), door)
    box("leaf", (1.6, 0.12, 2.7), (0, 0, 1.35), "#4a2a1c", dc)
    for px, pz in ((-0.38, 1.95), (0.38, 1.95), (-0.38, 0.7), (0.38, 0.7)):
        box("panel", (0.55, 0.14, 0.9), (px, -0.01, pz), "#3a2015", dc)
    g = empty("gargoyle", (0, -0.10, 1.45), dc)
    sph("ghead", 0.17, (0, 0, 0), "#7d8491", g, scale=(1, 0.7, 1), seg=10)
    for sx in (-1, 1):
        cyl("ear", 0.06, 0.16, (sx * 0.14, 0, 0.15), "#7d8491", g, r2=0.0, seg=5, rot=(0, R(sx * 25), 0))
        sph("glow_geye", 0.028, (sx * 0.065, -0.105, 0.03), "#22262e", g, seg=6)
    box("gjaw", (0.16, 0.10, 0.06), (0, -0.07, -0.10), "#6a707c", g)
    ring = empty("st_ring", (0, -0.20, 1.27), dc)
    cyl("ring", 0.13, 0.03, (0, 0, 0), "#e2b93b", ring, rot=(R(90), 0, 0), seg=16, metal=0.8, rough=0.3)
    cyl("ringhole", 0.085, 0.035, (0, 0, 0), "#3a2015", ring, rot=(R(90), 0, 0), seg=14)
    do = empty("st_door_open", (0, 0, 0), door)
    box("dark", (1.6, 0.10, 2.7), (0, 0.02, 1.35), "#020203", do)
    box("glow_doorway", (1.3, 0.05, 2.4), (0, -0.04, 1.25), "#3b1466", do, emit=1.2)
    box("leafopen", (0.12, 1.5, 2.7), (-0.86, -0.7, 1.35), "#4a2a1c", do, rot=(0, 0, R(-12)))
    # --- lanternas-abobora (os "olhos" da casa)
    for sx, n in ((-1, "L"), (1, "R")):
        h = empty("hs_lantern" + n, (sx * 3.3, 6.5, 0))
        cyl("post", 0.07, 1.0, (0, 0, 0.5), "#15131a", h, seg=6)
        cyl("plate", 0.26, 0.05, (0, 0, 1.0), "#15131a", h, seg=10)
        pumpkin("pump", (0, 0, 1.0), h, 1.05, lit=n)
    # --- caixa de correio
    mb = empty("hs_mailbox", (-5.2, 2.6, 0), rot=(0, 0, R(18)))
    box("post", (0.12, 0.12, 1.1), (0, 0, 0.55), "#3a2a1a", mb)
    box("mbody", (0.42, 0.75, 0.32), (0, 0, 1.22), "#7a2f22", mb)
    cyl("mtop", 0.21, 0.75, (0, 0, 1.38), "#7a2f22", mb, rot=(R(90), 0, 0), seg=10)
    box("flag", (0.03, 0.05, 0.30), (0.23, 0.15, 1.45), "#d63031", mb)
    box("plate", (0.30, 0.02, 0.10), (0, -0.385, 1.15), "#c9a227", mb, metal=0.7, rough=0.4)
    box("st_mail_lock", (0.10, 0.05, 0.12), (0, -0.40, 1.34), "#c9a227", mb, metal=0.8, rough=0.3)
    mo = empty("st_mail_open", (0, 0, 0), mb)
    box("flap", (0.40, 0.03, 0.42), (0, -0.52, 1.10), "#63261b", mo, rot=(R(75), 0, 0))
    box("letter", (0.26, 0.30, 0.02), (0, -0.42, 1.14), "#efe6c8", mo)
    # --- fonte seca com a estatua tombada
    fo = empty("hs_fountain", (5.8, 3.6, 0))
    cyl("basin", 1.45, 0.55, (0, 0, 0.275), "#5a5d6b", fo, seg=14)
    cyl("basin_in", 1.22, 0.06, (0, 0, 0.56), "#23252e", fo, seg=14)
    cyl("pedestal", 0.38, 1.0, (0, 0, 0.75), "#666978", fo, seg=8)

    def statue(name, loc, rot):
        s = empty(name, loc, fo, rot)
        cyl("sbody", 0.26, 1.1, (0, 0, 0.55), "#8a8fa0", s, r2=0.16, seg=8)
        sph("shead", 0.19, (0, 0, 1.25), "#8a8fa0", s, seg=10)
        for sx in (-1, 1):
            box("wing", (0.5, 0.06, 0.7), (sx * 0.34, 0.12, 0.8), "#7a7f90", s, rot=(0, R(sx * -20), R(sx * -18)))
        return s
    statue("st_statue_fallen", (-0.9, -0.5, 0.75), (R(8), R(78), R(25)))
    statue("st_statue_up", (0, 0, 1.25), (0, 0, R(10)))
    br = empty("st_brambles", (0, 0, 0), fo)
    for i in range(16):
        a = random.uniform(1.9, 5.3)
        rr = random.uniform(0.9, 1.6)
        cyl("thorn", 0.035, random.uniform(0.9, 1.5), (math.cos(a) * rr, math.sin(a) * rr, 0.55), "#2c3a22", br,
            rot=(random.uniform(-0.9, 0.9), random.uniform(-0.9, 0.9), 0), seg=4, r2=0.01)
    ca = empty("st_candle", (-0.55, -0.45, 0.6), fo)
    cyl("wax", 0.06, 0.16, (0, 0, 0.08), "#efe6c8", ca, seg=8)
    cyl("wick", 0.01, 0.04, (0, 0, 0.18), "#15131a", ca, seg=4)
    # --- arvore morta e o corvo
    tr = empty("tree", (-8.6, 6.4, 0))
    cyl("trunk", 0.55, 4.2, (0, 0, 2.1), "#1a1518", tr, r2=0.28, seg=7, smooth=False)
    for (lx, lz, ry, rz, ln, rr) in ((0.9, 3.6, 62, 0, 3.0, 0.16), (-0.8, 4.2, -50, 20, 2.4, 0.14), (0.2, 5.0, 14, 60, 2.2, 0.12),
                                     (1.9, 4.5, 30, -30, 1.4, 0.07), (-1.5, 5.3, -18, 10, 1.3, 0.06), (0.9, 5.9, 40, 100, 1.2, 0.05)):
        cyl("branch", rr, ln, (lx, 0, lz), "#1a1518", tr, r2=rr * 0.35, seg=5, rot=(0, R(ry), R(rz)), smooth=False)
    rv = empty("hs_raven", (-6.55, 6.4, 4.45))
    sph("rbody", 0.20, (0, 0, 0.18), "#0c0c12", rv, scale=(0.85, 1.25, 0.9), rot=(R(-25), 0, R(-35)), seg=10, rough=0.4)
    sph("rhead", 0.12, (0.09, -0.16, 0.38), "#0c0c12", rv, seg=8, rough=0.4)
    cyl("beak", 0.045, 0.16, (0.16, -0.27, 0.36), "#3a3a44", rv, r2=0.0, seg=5, rot=(R(95), 0, R(-35)))
    sph("glow_reye", 0.022, (0.15, -0.21, 0.42), "#ffe9a8", rv, seg=6, emit=2)
    box("tail", (0.12, 0.3, 0.04), (-0.12, 0.22, 0.10), "#0c0c12", rv, rot=(R(-25), 0, R(-35)))
    cyl("st_raven_ring", 0.10, 0.025, (0.20, -0.33, 0.27), "#e2b93b", rv, rot=(R(90), 0, R(-35)), seg=14, metal=0.8, rough=0.3)
    # --- portao (virou grade de masmorra)
    ga = empty("hs_gate", (9.6, -0.6, 0), rot=(0, 0, R(-52)))
    for sx in (-1, 1):
        box("pillar", (0.7, 0.7, 2.8), (sx * 1.7, 0, 1.4), "#4a4a58", ga)
        cyl("cap", 0.5, 0.4, (sx * 1.7, 0, 3.0), "#3a3a46", ga, r2=0.0, seg=4, rot=(0, 0, R(45)), smooth=False)
    for i in range(9):
        cyl("gbar", 0.04, 2.5, (-1.2 + i * 0.3, 0, 1.25), "#0f0e14", ga, seg=5)
        cyl("gtip", 0.07, 0.2, (-1.2 + i * 0.3, 0, 2.6), "#0f0e14", ga, r2=0.0, seg=5)
    for z in (0.3, 1.3, 2.3):
        box("gbarh", (2.8, 0.07, 0.07), (0, 0, z), "#0f0e14", ga)
    fence_run(-11.5, 9.5, -11.5, -1.0, 16)
    fence_run(11.5, 9.5, 11.5, 1.7, 12)
    fence_run(11.5, 1.7, 10.95, 1.05, 1)
    # --- a "mesa": manta, caixa do jogo, fichas, doces
    tb = empty("hs_table", (1.9, 1.3, 0), rot=(0, 0, R(-8)))
    box("blanket", (2.5, 1.8, 0.04), (0, 0, 0.02), "#8e2a2a", tb)
    for i in range(4):
        box("stripe", (2.5, 0.06, 0.045), (0, -0.7 + i * 0.47, 0.022), "#d8c9a0", tb)
        box("stripe", (0.06, 1.8, 0.046), (-1.0 + i * 0.66, 0, 0.022), "#d8c9a0", tb)
    box("gamebox", (0.62, 0.42, 0.13), (-0.55, 0.35, 0.10), "#15121c", tb, rot=(0, 0, R(12)))
    box("gamelabel", (0.44, 0.24, 0.135), (-0.55, 0.35, 0.101), "#b8912f", tb, rot=(0, 0, R(12)), metal=0.5, rough=0.4)
    box("board", (0.9, 0.7, 0.03), (0.25, 0.1, 0.055), "#2a3d33", tb)
    for i in range(6):
        a = i * math.pi / 3
        box("sheet", (0.26, 0.34, 0.012), (0.1 + math.cos(a) * 0.95, math.sin(a) * 0.68, 0.05), "#efe6c8", tb, rot=(0, 0, a + 1.57))
    cyl("lamp", 0.09, 0.22, (0.75, 0.55, 0.15), "#2b2b33", tb, seg=8)
    cyl("glow_lamp", 0.07, 0.13, (0.75, 0.55, 0.18), "#ffd27a", tb, seg=8, emit=5)
    for (bx, by, col) in ((-0.95, -0.5, "#d9691e"), (1.05, -0.45, "#7a3fb0"), (0.9, 0.1, "#d9691e")):
        cyl("bucket", 0.13, 0.2, (bx, by, 0.14), col, tb, r2=0.16, seg=8)
        for j in range(4):
            sph("candy", 0.035, (bx + random.uniform(-.07, .07), by + random.uniform(-.07, .07), 0.26), random.choice(["#ff5e7a", "#57d3ff", "#ffe14a", "#8dff6a"]), tb, seg=6)
    ico("d20", 0.085, (0.3, 0.1, 0.16), "#e9dfc4", rough=0.35)
    # --- cenografia
    for (x, y, s) in ((-3.9, 6.9, 0.8), (4.4, 6.6, 0.65), (-9.6, 2.2, 0.9), (8.2, 6.9, 0.7), (-2.6, -1.9, 0.75)):
        pumpkin("deco_pumpkin", (x, y, 0), None, s)
    for (x, y, s) in ((-9.8, 8.6, 1.3), (8.9, 8.8, 1.5), (-10.4, 0.4, 1.0), (10.3, 5.0, 1.1), (-4.9, 9.0, 1.0), (4.9, 9.1, 1.0)):
        sph("bush", 0.8 * s, (x, y, 0.45 * s), "#14221c", scale=(1.2, 1, 0.8), seg=8)
    for (x, y, a) in ((-8.3, 3.6, -8), (-7.3, 4.3, 6), (8.9, 3.9, 10)):
        t = empty("tomb", (x, y, 0), rot=(R(a), 0, R(a * 2)))
        box("tstone", (0.6, 0.16, 0.8), (0, 0, 0.4), "#565966", t)
        cyl("ttop", 0.3, 0.16, (0, 0, 0.8), "#565966", t, rot=(R(90), 0, 0), seg=10)
    sph("moon", 3.4, (11, 46, 19), "#f4efd2", seg=20, emit=2.2)
    for (x, z, s) in ((-22, 3, 14), (-4, 2, 18), (20, 3, 15), (34, 2, 12)):
        sph("hill", s, (x, 46, z - s * 0.75), "#0e1620", scale=(1.6, 0.5, 0.6), seg=12)
    export("exterior.glb")


# ----------------------------------------------------------------------------- Fase 2: hall

DOORS = [  # id, x, y, rot z (graus) - parede do fundo em y=9; alas inclinadas
    ("bia", -6.4, 8.9, 0), ("tomas", -3.4, 8.9, 0), ("iris", 3.4, 8.9, 0), ("leo", 6.4, 8.9, 0),
    ("caio", -9.75, 5.6, 62), ("nina", 9.75, 5.6, -62),
]


def build_hall():
    reset()
    random.seed(3)
    H = 6.6
    house, dung = empty("house_set"), empty("dung_set")
    # piso
    box("house_floor", (24, 14, 0.2), (0, 4, -0.1), "#5a3a26", house)
    for i in range(12):
        box("plank", (0.04, 14, 0.21), (-11 + i * 2, 4, -0.1), "#3d2617", house)
    box("rug", (7, 5, 0.03), (0, 3.6, 0.015), "#7a1f2b", house)
    box("rug2", (6.2, 4.2, 0.035), (0, 3.6, 0.017), "#96303a", house)
    box("dung_floor", (24, 14, 0.2), (0, 4, -0.1), "#34343f", dung)
    for i in range(46):
        box("flag", (random.uniform(1.0, 1.9), random.uniform(0.8, 1.4), 0.05),
            (random.uniform(-10.5, 10.5), random.uniform(-2, 8.6), random.uniform(0.0, 0.02)),
            random.choice(["#3d3d4a", "#444452", "#383844", "#4a4a57"]), dung, rot=(0, 0, random.uniform(-0.1, 0.1)))
    # mosaico do D20 (a "mesa" da casa)
    mo = empty("hs_mosaic", (0, 3.6, 0), dung)
    cyl("mring", 2.3, 0.08, (0, 0, 0.03), "#1c1c26", mo, seg=20, smooth=False)
    cyl("mdisc", 2.1, 0.09, (0, 0, 0.035), "#55506e", mo, seg=20, smooth=False)
    cyl("glow_mosaic", 1.5, 0.10, (0, 0, 0.04), "#7a3cff", mo, seg=6, smooth=False, emit=0.6)
    cyl("mhex", 1.3, 0.11, (0, 0, 0.045), "#2a2440", mo, seg=6, smooth=False)
    cyl("mtri", 0.9, 0.12, (0, 0, 0.05), "#55506e", mo, seg=3, smooth=False)

    # paredes: fundo + duas alas
    def walls(parent, col, base, pre):
        box(pre + "back", (18.4, 0.5, H), (0, 9.25, H / 2), col, parent)
        for sx in (-1, 1):
            box(pre + "wing", (0.5, 8.4, H), (sx * 10.95, 5.3, H / 2), col, parent, rot=(0, 0, R(sx * -28)))
            box(pre + "wingbase", (0.6, 8.4, 0.5), (sx * 10.9, 5.3, 0.25), base, parent, rot=(0, 0, R(sx * -28)))
        box(pre + "baseb", (18.4, 0.6, 0.5), (0, 9.2, 0.25), base, parent)
        box(pre + "ceil", (26, 14, 0.3), (0, 4, H + 0.15), base, parent)
    walls(house, "#5b3f52", "#2c1c22", "house_")
    walls(dung, "#3f3f4d", "#24242e", "dung_")
    for i in range(16):       # papel de parede listrado
        box("stripe", (0.12, 0.52, H - 1.1), (-8.6 + i * 1.15, 9.24, H / 2 + 0.45), "#6d4c63", house)
    box("wains", (18.4, 0.56, 1.1), (0, 9.24, 0.95), "#3d2617", house)
    for i in range(70):       # blocos de pedra salientes
        onback = random.random() < 0.6
        col = random.choice(["#4a4a59", "#383844", "#515162", "#2f2f3a"])
        if onback:
            box("brick", (random.uniform(0.8, 1.5), 0.56, random.uniform(0.4, 0.7)),
                (random.uniform(-8.8, 8.8), 9.25, random.uniform(0.6, H - 0.3)), col, dung)
        else:
            sx = random.choice((-1, 1))
            t = random.uniform(-3.8, 3.8)
            a = R(sx * -28)
            box("brick", (0.56, random.uniform(0.8, 1.4), random.uniform(0.4, 0.7)),
                (sx * 10.95 - math.sin(a) * t, 5.3 + math.cos(a) * t, random.uniform(0.6, H - 0.3)), col, dung, rot=(0, 0, a))
    # portas (casa: lisas; masmorra: ferro, emblema e hotspot)
    for kid, x, y, rz in DOORS:
        for parent, pre in ((house, "house_door_"), (dung, "hs_door_")):
            d = empty(pre + kid, (x, y, 0), parent, (0, 0, R(rz)))
            isd = parent is dung
            box("frame", (2.1, 0.3, 3.5), (0, 0, 1.75), "#1c1c24" if isd else "#2c1c22", d)
            box("leaf", (1.7, 0.2, 3.2), (0, -0.1, 1.6), "#3a2a22" if isd else "#6b452c", d)
            if isd:
                cyl("arch", 1.05, 0.3, (0, 0, 3.4), "#1c1c24", d, rot=(R(90), 0, 0), seg=12)
                cyl("archleaf", 0.85, 0.2, (0, -0.1, 3.2), "#3a2a22", d, rot=(R(90), 0, 0), seg=12)
                for z in (0.6, 1.7, 2.8):
                    box("band", (1.74, 0.05, 0.14), (0, -0.21, z), "#15151b", d, metal=0.6, rough=0.5)
                emblem(kid, d, (0, -0.26, 2.25), 1.15)
                box("glow_seal_" + kid, (1.5, 0.02, 0.06), (0, -0.215, 0.12), "#7a3cff", d, emit=1.5)
            else:
                for px in (-0.4, 0.4):
                    box("panel", (0.6, 0.04, 1.2), (px, -0.21, 2.3), "#5a3a26", d)
                    box("panel", (0.6, 0.04, 1.0), (px, -0.21, 0.85), "#5a3a26", d)
                sph("knob", 0.07, (0.65, -0.26, 1.5), "#c9a227", d, seg=8, metal=0.8, rough=0.3)
    # relogio (partilhado) + mostradores
    ck = empty("hs_clock", (0, 8.75, 0))
    box("cbase", (1.5, 0.8, 0.9), (0, 0, 0.45), "#2b1a12", ck)
    box("cbody", (1.15, 0.6, 2.0), (0, 0, 1.9), "#3a2418", ck)
    box("st_clock_glass", (0.8, 0.04, 1.6), (0, -0.31, 1.9), "#9fc4d6", ck, rough=0.05)
    box("cwindow", (0.85, 0.03, 1.65), (0, -0.295, 1.9), "#120c09", ck)
    cyl("pend_rod", 0.02, 1.1, (0, -0.25, 2.2), "#c9a227", ck, seg=5, metal=0.8, rough=0.3)
    pend = empty("pendulum", (0, -0.25, 2.75), ck)
    cyl("pend_rod2", 0.02, 1.3, (0, 0, -0.65), "#c9a227", pend, seg=5, metal=0.8, rough=0.3)
    cyl("pend_bob", 0.17, 0.05, (0, 0, -1.3), "#c9a227", pend, rot=(R(90), 0, 0), seg=14, metal=0.8, rough=0.3)
    box("chead", (1.7, 0.75, 1.7), (0, 0, 3.75), "#3a2418", ck)
    cyl("ctop", 0.85, 0.75, (0, 0, 4.6), "#2b1a12", ck, rot=(R(90), 0, 0), seg=14)
    cyl("face", 0.72, 0.06, (0, -0.38, 3.8), "#efe6c8", ck, rot=(R(90), 0, 0), seg=24)
    hf = empty("house_clockface", (0, -0.42, 3.8), ck)
    for i in range(12):
        a = i * math.pi / 6
        box("tick", (0.04, 0.02, 0.13), (math.sin(a) * 0.6, 0, math.cos(a) * 0.6), "#15121c", hf, rot=(0, a, 0))
    df = empty("dung_clockface", (0, -0.42, 3.8), ck)
    for i, kid in enumerate(["caio", "nina", "iris", "leo", "bia", "tomas"]):
        a = i * math.pi / 3
        emblem(kid, df, (math.sin(a) * 0.5, 0, math.cos(a) * 0.5), 0.42, col="#6a1fb0", name="dial_" + kid)
    hand = empty("clock_hand", (0, -0.47, 3.8), ck)
    box("hand", (0.06, 0.02, 0.44), (0, 0, 0.2), "#15121c", hand)
    cyl("hub", 0.06, 0.04, (0, 0, 0), "#15121c", hand, rot=(R(90), 0, 0), seg=8)
    # placa runica
    pl = empty("hs_plaque", (0, 8.95, 5.55), dung)
    box("slab", (3.4, 0.14, 0.7), (0, 0, 0), "#23232c", pl)
    for i in range(22):
        box("glow_rune", (0.05, 0.02, random.uniform(0.12, 0.3)), (-1.45 + i * 0.138, -0.08, random.uniform(-0.08, 0.08)),
            "#9d6bff", pl, rot=(0, random.uniform(-0.6, 0.6), 0), emit=2.5)
    # retratos
    for i, x in enumerate((-7.6, -4.9, -2.0, 2.0, 4.9, 7.6)):
        p = empty("hs_portrait_%d" % i, (x, 8.95, 4.75))
        box("pframe", (1.25, 0.12, 1.55), (0, 0, 0), "#b8912f", p, metal=0.6, rough=0.4)
        box("portrait_%d" % i, (1.0, 0.04, 1.3), (0, -0.06, 0), "#2a2230", p)
        box("pplate", (0.6, 0.03, 0.12), (0, -0.07, -0.9), "#c9a227", p, metal=0.7, rough=0.4)
    # lustre (casa) / tochas e correntes (masmorra)
    ch = empty("house_chandelier", (0, 4, H - 1.6), house)
    cyl("chain", 0.03, 1.6, (0, 0, 0.8), "#c9a227", ch, seg=5)
    cyl("ringc", 1.0, 0.08, (0, 0, 0), "#c9a227", ch, seg=14, metal=0.7, rough=0.4)
    for i in range(8):
        a = i * math.pi / 4
        cyl("cand", 0.04, 0.25, (math.cos(a) * 0.95, math.sin(a) * 0.95, 0.15), "#efe6c8", ch, seg=6)
        sph("glow_chand", 0.05, (math.cos(a) * 0.95, math.sin(a) * 0.95, 0.32), "#ffd27a", ch, seg=6, emit=4)
    for i, (x, y, rz) in enumerate(((-4.9, 8.95, 0), (4.9, 8.95, 0), (-1.75, 8.95, 0), (1.75, 8.95, 0), (-10.4, 3.4, 62), (10.4, 3.4, -62))):
        t = empty("torch_%d" % i, (x, y, 2.9), dung, (0, 0, R(rz)))
        box("tarm", (0.08, 0.3, 0.08), (0, -0.15, 0), "#15151b", t)
        cyl("thandle", 0.05, 0.5, (0, -0.32, 0.12), "#3a2418", t, seg=6, rot=(R(-15), 0, 0))
        cyl("glow_torch", 0.11, 0.34, (0, -0.37, 0.52), "#b56bff", t, r2=0.0, seg=6, emit=5)
    for (x, ln) in ((-8.6, 1.8), (8.4, 2.4), (-1.2, 1.1), (5.5, 1.5)):
        for j in range(int(ln / 0.16)):
            box("link", (0.07, 0.03, 0.14), (x, 8.9, H - 0.1 - j * 0.16), "#15151b", dung, rot=(0, 0, R(90 * (j % 2))))
    # bau / mimico
    for parent, name, isd in ((house, "house_chest", False), (dung, "hs_mimic", True)):
        c = empty(name, (6.9, 5.4, 0), parent, (0, 0, R(-24)))
        box("cbody", (1.3, 0.85, 0.6), (0, 0, 0.3), "#5a3a1e", c)
        for bx in (-0.5, 0.5):
            box("cband", (0.1, 0.89, 0.62), (bx, 0, 0.3), "#b8912f", c, metal=0.6, rough=0.4)
        lid = empty("mimic_lid", (0, 0.42, 0.6), c, (R(-22) if isd else 0, 0, 0))
        cyl("lidm", 0.425, 1.3, (0, -0.42, 0), "#6b452c", lid, rot=(0, R(90), 0), seg=12, scale=(0.6, 1, 1))
        if isd:
            for i in range(7):
                cyl("tooth", 0.055, 0.17, (-0.5 + i * 0.167, -0.40, 0.66), "#f2ecd8", c, r2=0.0, seg=4)
                cyl("tooth", 0.055, 0.15, (-0.42 + i * 0.167, -0.80, -0.07), "#f2ecd8", lid, r2=0.0, seg=4, rot=(R(180), 0, 0))
            for sx in (-1, 1):
                sph("glow_meye", 0.07, (sx * 0.25, -0.62, 0.2), "#ffe14a", lid, seg=8, emit=3)
            sph("tongue", 0.2, (0, -0.35, 0.62), "#b03a5a", c, scale=(1, 1.4, 0.3), seg=8)
        else:
            box("lock", (0.14, 0.05, 0.16), (0, -0.44, 0.5), "#c9a227", c, metal=0.7, rough=0.4)
    # armadura decorativa
    ar = empty("hs_armor", (-6.9, 5.6, 0), None, (0, 0, R(24)))
    box("abase", (0.9, 0.9, 0.2), (0, 0, 0.1), "#23232c", ar)
    for sx in (-1, 1):
        cyl("aleg", 0.13, 0.9, (sx * 0.17, 0, 0.65), "#8b93a1", ar, seg=8, metal=0.8, rough=0.35)
        cyl("aarm", 0.10, 0.85, (sx * 0.43, 0, 1.45), "#8b93a1", ar, seg=8, metal=0.8, rough=0.35)
    cyl("achest", 0.33, 0.8, (0, 0, 1.5), "#9aa3b2", ar, r2=0.38, seg=8, metal=0.8, rough=0.3)
    sph("ahelm", 0.22, (0, 0, 2.15), "#9aa3b2", ar, seg=10, metal=0.8, rough=0.3)
    box("avisor", (0.3, 0.06, 0.05), (0, -0.2, 2.17), "#0c0c12", ar)
    cyl("ahalberd", 0.03, 2.9, (0.6, -0.1, 1.45), "#3a2418", ar, seg=5)
    cyl("ahead", 0.2, 0.4, (0.6, -0.1, 3.0), "#b0b7c4", ar, r2=0.0, seg=4, metal=0.8, rough=0.3, scale=(1, 0.2, 1))
    # mobiliario da casa
    box("house_table", (1.6, 0.6, 0.9), (-3.4, 8.6, 0.45), "#3d2617", house)
    cyl("house_vase", 0.16, 0.5, (-3.4, 8.6, 1.15), "#3f6b8a", house, r2=0.09, seg=8)
    box("house_mirror", (1.3, 0.08, 1.9), (3.4, 8.96, 2.3), "#9fc4d6", house, rough=0.05, metal=0.6)
    box("house_mirrorf", (1.5, 0.06, 2.1), (3.4, 8.98, 2.3), "#b8912f", house, metal=0.6, rough=0.4)
    # ossos e teias da masmorra
    for (x, y) in ((-8.2, 7.6), (8.6, 2.2), (-9.3, 2.0)):
        for j in range(4):
            sph("skull", 0.14, (x + random.uniform(-.3, .3), y + random.uniform(-.3, .3), 0.13), "#d9d2bb", dung, seg=8)
            cyl("bone", 0.035, 0.5, (x + random.uniform(-.5, .5), y + random.uniform(-.5, .5), 0.04), "#d9d2bb", dung,
                rot=(R(90), 0, random.uniform(0, 3)), seg=5)
    ico("d20", 0.085, (0, 3.6, 0.2), "#e9dfc4", rough=0.35)
    export("hall.glb")


if __name__ == "__main__":
    for kid in KIDS:
        build_kid(kid)
    build_exterior()
    build_hall()
