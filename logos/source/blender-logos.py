# BYU Calendar 3D logo renders. Run via blender-launcher -b -P blender-logos.py -- --scene <name>
import bpy, sys, math, os
from mathutils import Vector, Color

OUT = 'C:/Users/jarin/OneDrive/Desktop/VibeDev/BYUCalendar/logos/3d'
FONT_A900 = 'C:/Users/jarin/AppData/Local/Temp/byu-logos-work/fonts/Archivo-900.ttf'
FONT_A800 = 'C:/Users/jarin/AppData/Local/Temp/byu-logos-work/fonts/Archivo-800.ttf'
os.makedirs(OUT, exist_ok=True)

INK = '#202124'; BLUE = '#1a73e8'; BLUE_D = '#174aa6'; WHITE = '#ffffff'
GREEN = '#188038'; PURPLE = '#7627bb'; ORANGE = '#e8710a'; TEAL = '#00796b'
PALE_BLUE = '#e8f0fe'; PALE_ORANGE = '#fef0df'

def srgb(hexstr):
    c = Color.from_hex(hexstr) if hasattr(Color, 'from_hex') else None
    if c is not None:
        # Color.from_hex gives sRGB components; Principled expects linear
        lin = Color((*(pow(v, 2.2) for v in c),))
        return lin
    return Color((0.5, 0.5, 0.5))

def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(hexcolor, rough=0.38, name=None):
    m = bpy.data.materials.new(name or ('m' + hexcolor))
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*srgb(hexcolor), 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    for spec_name in ('Specular IOR Level', 'Specular'):
        if spec_name in bsdf.inputs:
            bsdf.inputs[spec_name].default_value = 0.12
            break
    return m

def outline(obj, thickness=0.03):
    """Inverted-hull toon outline."""
    dup = obj.copy()
    dup.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(dup)
    mod = dup.modifiers.new('Outline', 'SOLIDIFY')
    mod.thickness = -thickness
    mod.offset = 0.0
    m = mat(INK, rough=0.6)
    dup.data.materials.clear()
    dup.data.materials.append(m)
    return dup

def rounded_box(name, loc, scale, bevel=0.09, material=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    mod = o.modifiers.new('Bevel', 'BEVEL')
    mod.width = bevel; mod.segments = 6; mod.limit_method = 'ANGLE'
    if material:
        o.data.materials.append(material)
    return o

def make_text(body, font_path, size, loc, extrude=0.12, bevel=0.012, material=None, rot=(0, 0, 0), align='CENTER'):
    tc = bpy.data.curves.new('tc', type='FONT')
    tc.body = body
    tc.font = bpy.data.fonts.load(font_path)
    tc.size = size
    tc.extrude = extrude
    tc.bevel_depth = bevel
    tc.bevel_resolution = 3
    tc.resolution_u = 12
    tc.align_x = align
    tc.align_y = 'CENTER'
    t = bpy.data.objects.new(body, tc)
    t.location = loc
    t.rotation_euler = rot
    bpy.context.scene.collection.objects.link(t)
    if material:
        tc.materials.append(material)
    return t

def setup_render(w, h, samples=96):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.transparent_max_bounces = 12
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    return sc

def studio(cam_loc, look_at, focal=60, ortho=False, ortho_scale=4.4):
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    cam.location = cam_loc
    bpy.context.scene.collection.objects.link(cam)
    if ortho:
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = ortho_scale
    else:
        cam_data.lens = focal
    direction = Vector(look_at) - Vector(cam_loc)
    rot = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.rotation_euler = rot
    sc.camera = cam
    # key / fill / rim area lights
    for name, loc, size, energy in [
        ('key', (4, -6, 7), 5, 900),
        ('fill', (-6, -4, 2), 6, 300),
        ('rim', (-2, 5, 5), 4, 400),
    ]:
        ld = bpy.data.lights.new(name, type='AREA')
        ld.shape = 'SQUARE'; ld.size = size; ld.energy = energy
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        bpy.context.scene.collection.objects.link(lo)
        d = Vector((0, 0, 0)) - Vector(loc)
        lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return cam

def shadow_floor(y=-1.6):
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, y))
    f = bpy.context.active_object
    for attr_host, attr in ((getattr(f, 'cycles', None), 'is_shadow_catcher'), (f, 'is_shadow_catcher')):
        if attr_host is not None and hasattr(attr_host, attr):
            setattr(attr_host, attr, True)
            return f
    # shadow catcher unavailable: drop the floor entirely (floating render)
    bpy.data.objects.remove(f, do_unlink=True)
    return None

def build_tile(rot=(math.radians(-14), 0, math.radians(8)), cam=(5.2, -7.4, 5.6), ortho=False, ortho_scale=4.6, fname='41-3d-y-tile-tilt.png', focal=55):
    clean()
    white = mat(WHITE); blue = mat(BLUE); ink = mat(INK)
    tile = rounded_box('tile', (0, 0, 0), (1.5, 1.5, 0.22), bevel=0.10, material=white, rot=rot)
    outline(tile, 0.035)
    # blue header band: proud slab at top of face (local z front)
    band = rounded_box('band', (0, 0.52, 0.0), (1.5, 0.44, 0.24), bevel=0.07, material=blue, rot=rot)
    outline(band, 0.032)
    # ring posts
    for x in (-0.42, 0.42):
        r = rounded_box('ring', (x, 1.05, 0.0), (0.13, 0.3, 0.16), bevel=0.06, material=white, rot=rot)
        outline(r, 0.028)
    # Y glyph on the face, below band (offset along local +y in tile space)
    yy = make_text('Y', FONT_A900, 1.15, (0, -0.06, 0.13), extrude=0.10, bevel=0.014, material=ink, rot=rot, align='CENTER')
    # place glyph in front of face: transform local offset through tile rotation
    yy.location = Vector((0, -0.12, 0.14)) @ rot_matrix(rot).transposed() if False else yy.location
    sc = setup_render(1024, 1024)
    studio(cam, (0, 0, 0.1), focal=focal, ortho=ortho, ortho_scale=ortho_scale)
    shadow_floor(-1.9)
    sc.render.filepath = f'{OUT}/{fname}'
    bpy.ops.render.render(write_still=True)
    print('RENDERED', fname, flush=True)

def rot_matrix(rot):
    from mathutils import Euler
    return Euler(rot).to_matrix().to_4x4()

# ---- scenes -------------------------------------------------------------------
def scene_tile_tilt():
    build_tile(rot=(math.radians(-12), 0, math.radians(9)), cam=(5.6, -7.8, 5.2), fname='41-3d-y-tile-tilt.png')

def scene_tile_appicon():
    build_tile(rot=(0, 0, 0), cam=(0, -7.5, 0), ortho=True, ortho_scale=4.35, fname='42-3d-y-tile-appicon.png', focal=50)

def scene_stack():
    clean()
    white = mat(WHITE); blue = mat(BLUE); ink = mat(INK)
    pb = mat(PALE_BLUE); po = mat(PALE_ORANGE)
    back1 = rounded_box('b1', (-0.7, -0.25, 0.15), (1.25, 1.25, 0.1), bevel=0.08, material=pb, rot=(math.radians(-8), 0, math.radians(14)))
    outline(back1, 0.028)
    back2 = rounded_box('b2', (0.75, -0.05, 0.05), (1.2, 1.2, 0.1), bevel=0.08, material=po, rot=(math.radians(6), 0, math.radians(-11)))
    outline(back2, 0.028)
    front = rounded_box('front', (0, 0.25, 0.35), (1.45, 1.45, 0.16), bevel=0.09, material=white)
    outline(front, 0.033)
    band = rounded_box('fband', (0, 0.72, 0.35), (1.45, 0.42, 0.18), bevel=0.07, material=blue)
    outline(band, 0.03)
    make_text('Y', FONT_A900, 1.0, (0, -0.15, 0.48), extrude=0.09, bevel=0.012, material=ink)
    # dot grids floating just proud of the back cards' front faces
    # card1: center (-0.7,-0.25,0.15), face z≈0.25; card2: center (0.75,-0.05,0.05), face z≈0.15
    for (bx, by, bz) in ((-0.7, -0.25, 0.29), (0.75, -0.05, 0.19)):
        for i in range(3):
            for j in range(2):
                bpy.ops.mesh.primitive_uv_sphere_add(
                    radius=0.055, location=(bx + (i - 1) * 0.32, by + (j - 0.5) * 0.42, bz))
    sc = setup_render(1024, 1024)
    studio((5.8, -8.2, 6.4), (0, 0, 0.2), focal=52)
    shadow_floor(-2.1)
    sc.render.filepath = f'{OUT}/43-3d-stack-pages.png'
    bpy.ops.render.render(write_still=True)
    print('RENDERED 43', flush=True)

def scene_wordmark():
    clean()
    ink = mat(INK); blue = mat(BLUE)
    # hard offset shadow copy behind, then ink text in front
    make_text('BYU Calendar', FONT_A800, 1.0, (0.05, 0.7, -0.06), extrude=0.16, bevel=0.014, material=blue)
    make_text('BYU Calendar', FONT_A800, 1.0, (0, 0, 0), extrude=0.16, bevel=0.014, material=ink)
    sc = setup_render(2048, 768, samples=96)
    studio((0.9, -9.5, 1.4), (0, 0, 0.1), focal=60)
    sc.render.filepath = f'{OUT}/44-3d-wordmark.png'
    bpy.ops.render.render(write_still=True)
    print('RENDERED 44', flush=True)

def scene_cube_y():
    clean()
    cells = [(-1, 1, BLUE), (1, 1, GREEN), (-0.5, 0.5, PURPLE), (0.5, 0.5, ORANGE), (0, 0, TEAL), (0, -1, BLUE), (0, -2, INK)]
    for x, y, col in cells:
        c = rounded_box('c', (x * 0.62, y * 0.62, 0), (0.55, 0.55, 0.55), bevel=0.13, material=mat(col, rough=0.32))
        c.rotation_euler = (math.radians(-8), 0, math.radians(18 if (x + y) % 2 == 0 else -14))
    sc = setup_render(1024, 1024)
    # isometric camera
    studio((6.2, -6.2, 5.0), (0, 0, 0), focal=50)
    shadow_floor(-2.4)
    sc.render.filepath = f'{OUT}/45-3d-cube-y.png'
    bpy.ops.render.render(write_still=True)
    print('RENDERED 45', flush=True)

if __name__ == '__main__':
    import traceback
    try:
        argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
        scene = next((a.split('=')[1] for a in argv if a.startswith('--scene=')), 'tiletilt')
        {'tiletilt': scene_tile_tilt, 'appicon': scene_tile_appicon, 'stack': scene_stack,
         'wordmark': scene_wordmark, 'cubey': scene_cube_y}[scene]()
    except Exception:
        with open('C:/Users/jarin/AppData/Local/Temp/byu-logos-work/blender-error.log', 'w') as f:
            f.write(traceback.format_exc())
        raise
