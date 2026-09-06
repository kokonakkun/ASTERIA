from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SIZE = 1024

image = Image.new("RGBA", (SIZE, SIZE), (7, 7, 13, 255))
pixels = image.load()
for y in range(SIZE):
    for x in range(SIZE):
        dx = (x - 330) / SIZE
        dy = (y - 250) / SIZE
        glow = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy) / 0.82)
        pixels[x, y] = (
            int(7 + glow * 24),
            int(7 + glow * 18),
            int(13 + glow * 40),
            255,
        )

mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=220, fill=255)
image.putalpha(mask)

glow_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow_layer)
glow_draw.ellipse((345, 345, 679, 679), fill=(155, 124, 255, 145))
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(65))
image = Image.alpha_composite(image, glow_layer)

orbit_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
orbit_draw = ImageDraw.Draw(orbit_layer)
orbit_draw.ellipse((125, 370, 899, 654), outline=(171, 145, 255, 205), width=17)
orbit_layer = orbit_layer.rotate(24, resample=Image.Resampling.BICUBIC, center=(512, 512))
image = Image.alpha_composite(image, orbit_layer)

core = Image.new("RGBA", image.size, (0, 0, 0, 0))
core_pixels = core.load()
radius = 150
for y in range(512 - radius, 512 + radius + 1):
    for x in range(512 - radius, 512 + radius + 1):
        dx, dy = x - 512, y - 512
        distance = math.sqrt(dx * dx + dy * dy)
        if distance <= radius:
            t = distance / radius
            light = max(0, 1 - math.sqrt((x - 475) ** 2 + (y - 468) ** 2) / 230)
            core_pixels[x, y] = (
                int(80 + 110 * (1 - t) + 65 * light),
                int(52 + 95 * (1 - t) + 75 * light),
                int(177 + 62 * (1 - t) + 16 * light),
                255,
            )
image = Image.alpha_composite(image, core)

draw = ImageDraw.Draw(image)
draw.ellipse((688, 286, 724, 322), fill=(255, 255, 255, 255))
draw.ellipse((677, 275, 735, 333), outline=(255, 255, 255, 60), width=5)

png = image.resize((512, 512), Image.Resampling.LANCZOS)
png.save(ASSETS / "icon.png")
image.save(ASSETS / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f"Generated {ASSETS / 'icon.png'} and {ASSETS / 'icon.ico'}")
