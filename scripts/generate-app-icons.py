"""Generate Expo app icons, adaptive icons, splash and web favicon.

Deliberately generated rather than drawn: these apps are white-label, so the
icon has to come from whatever brand the build is for. Same approach the
back-office favicon already takes (web-admin/app/api/icon) — a tile in the
brand colour carrying the brand's initial — so a vendor that has set a colour
and a name gets a correct icon without being asked for a 1024x1024 file.

The shared Locare builds are the exception: they carry the real mark rather
than a generated letter, so pass that SVG instead of an initial.

Usage:
    python3 generate-app-icons.py <out_dir> <hex_colour> <initial> <on_colour>
    python3 generate-app-icons.py <out_dir> <hex_colour> --mark <mark.svg>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = "/mnt/user-data/uploads/PMS0.3/mobile-tenant/node_modules/@expo-google-fonts/plus-jakarta-sans/PlusJakartaSans_800ExtraBold.ttf"


def tile(size, bg, fg, letter, radius_ratio=0.225, inset=0, letter_ratio=0.52):
    """A rounded square in the brand colour with the initial centred on it."""
    scale = 4  # supersample, then downsize: keeps the curve and the letter clean
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(inset * s)
    d.rounded_rectangle(
        [pad, pad, s - pad - 1, s - pad - 1],
        radius=int((s - 2 * pad) * radius_ratio),
        fill=bg,
    )
    f = ImageFont.truetype(FONT, int((s - 2 * pad) * letter_ratio))
    # Centre on the glyph's ink box, not its advance box: optical centring.
    box = d.textbbox((0, 0), letter, font=f)
    d.text(
        ((s - (box[2] - box[0])) / 2 - box[0], (s - (box[3] - box[1])) / 2 - box[1]),
        letter, font=f, fill=fg,
    )
    return img.resize((size, size), Image.LANCZOS)


def from_mark(out, bg, svg):
    """Locare's own builds: rasterise the brand mark instead of drawing a letter.

    The Android foreground needs the glyph alone, so the tile fill is dropped
    from a copy of the SVG rather than keyed out of a raster, which would leave
    a fringe on the antialiased edge.
    """
    import re, subprocess, tempfile, os
    src = open(svg, encoding="utf-8").read()
    glyph = re.sub(r'fill="%s"' % bg.upper(), 'fill="none"', src, count=1,
                   flags=re.IGNORECASE)
    if glyph == src:
        raise SystemExit(f"tile fill {bg} not found in {svg}")
    tmp = os.path.join(tempfile.gettempdir(), "glyph-only.svg")
    open(tmp, "w", encoding="utf-8").write(glyph)

    subprocess.run(["rsvg-convert", "-w", "1024", svg, "-o", f"{out}/icon.png"], check=True)
    subprocess.run(["rsvg-convert", "-w", "460", tmp, "-o", f"{out}/.glyph.png"], check=True)

    g = Image.open(f"{out}/.glyph.png").convert("RGBA")
    ad = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    ad.paste(g, ((1024 - 460) // 2, (1024 - 460) // 2), g)
    ad.save(f"{out}/adaptive-icon.png")

    m = Image.open(f"{out}/icon.png").convert("RGBA").resize((420, 420), Image.LANCZOS)
    sp = Image.new("RGBA", (1242, 2436), (0, 0, 0, 0))
    sp.paste(m, ((1242 - 420) // 2, (2436 - 420) // 2), m)
    sp.save(f"{out}/splash.png")

    Image.open(f"{out}/icon.png").convert("RGBA").resize((96, 96), Image.LANCZOS) \
        .save(f"{out}/favicon.png")
    os.remove(f"{out}/.glyph.png")
    print(f"{out}: icon, adaptive-icon, splash, favicon  (from {svg})")


def main():
    if sys.argv[3] == "--mark":
        return from_mark(sys.argv[1], sys.argv[2], sys.argv[4])
    out, bg, letter, fg = sys.argv[1], sys.argv[2], sys.argv[3].upper()[:1], sys.argv[4]

    # Store icon: full bleed, the platform applies its own mask.
    tile(1024, bg, fg, letter).save(f"{out}/icon.png")

    # Android adaptive: the launcher crops to a circle, so the glyph sits in the
    # safe 66% centre and the background colour is declared in app.json.
    tile(1024, bg, fg, letter, radius_ratio=0.5, inset=0.17, letter_ratio=0.34).save(
        f"{out}/adaptive-icon.png"
    )

    # Splash: one centred mark on a plain ground, sized for `resizeMode: contain`.
    sp = Image.new("RGBA", (1242, 2436), (0, 0, 0, 0))
    mark = tile(420, bg, fg, letter)
    sp.paste(mark, ((1242 - 420) // 2, (2436 - 420) // 2), mark)
    sp.save(f"{out}/splash.png")

    # Web export favicon.
    tile(96, bg, fg, letter).save(f"{out}/favicon.png")
    print(f"{out}: icon, adaptive-icon, splash, favicon  ({bg} / {letter})")


if __name__ == "__main__":
    main()
