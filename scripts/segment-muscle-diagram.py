#!/usr/bin/env python3
"""
One-off: segments the front figure's arms and legs out of
frontend/assets/muscle-diagram.png into their own PNGs (so
MuscleDiagramSVG.tsx can rotate them independently around a shoulder/hip
pivot), and saves a "base" copy of the diagram with those regions erased
(filled with the image's flat background color) so the limb pieces can be
laid back on top with zero seam when un-rotated.

Each piece's canvas is padded well beyond the limb's own tight silhouette —
a rotated rectangle needs room to swing into, or it just clips invisibly
against its own bounding box (the first version of this script didn't pad
at all, and the rotation was completely invisible in practice). Padding is
asymmetric: generous on the side the limb swings away from the body,
minimal on the torso-facing side (padding that direction would capture
torso pixels, since limb and torso are visually contiguous up to the
shoulder/hip separation point).

TIGHT_REGIONS below are the limb's own bounding box (used only to size the
erased hole in the base image). PADDED_REGIONS are each piece's actual
canvas — big enough for its rotation range — with PIVOTS giving the
shoulder/hip joint's position in the ORIGINAL 900×600 image; the script
converts that into each piece's own local coordinate space.

All coordinates were measured directly from the source image's pixels
(scanning rows for background-vs-figure transitions), not eyeballed — see
the reconstruction check at the bottom.

Only the FRONT (left) figure is segmented — the back figure stays fully
static as an anatomical reference.

Usage:
    python3 scripts/segment-muscle-diagram.py
"""

from PIL import Image
import os

SRC = os.path.join(os.path.dirname(__file__), "../frontend/assets/muscle-diagram.png")
OUT_DIR = os.path.join(os.path.dirname(__file__), "../frontend/assets")

# (x0, y0, x1, y1) — the limb's own tight silhouette, used to size the hole
# erased from the base image.
TIGHT_REGIONS = {
    "left-arm":  (160, 210, 235, 358),
    "right-arm": (345, 210, 420, 358),
    "left-leg":  (235, 348, 290, 562),
    "right-leg": (293, 348, 348, 562),
}

# (x0, y0, x1, y1) — each piece's actual canvas, padded outward (away from
# the torso) for rotation room. Torso-facing edge stays at/near the tight
# region's own boundary.
PADDED_REGIONS = {
    "left-arm":  (90, 206, 235, 368),
    "right-arm": (345, 206, 490, 368),
    "left-leg":  (185, 345, 290, 572),
    "right-leg": (293, 345, 398, 572),
}

# Shoulder/hip joint position in the ORIGINAL 900×600 image.
PIVOTS = {
    "left-arm":  (200, 212),
    "right-arm": (380, 212),
    "left-leg":  (258, 352),
    "right-leg": (322, 352),
}

img = Image.open(SRC).convert("RGBA")
bg = img.getpixel((5, 5))

def remove_background(im, bg_color, tol=30):
    """Key out the flat background color to transparent, leaving only the
    limb's own silhouette opaque — the source PNG has no real transparency
    (solid background), so a plain rectangular crop rotates as a visible
    opaque rectangle. Only the actual limb shape should rotate."""
    im = im.convert("RGBA")
    pixels = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = pixels[x, y]
            if abs(r - bg_color[0]) <= tol and abs(g - bg_color[1]) <= tol and abs(b - bg_color[2]) <= tol:
                pixels[x, y] = (r, g, b, 0)
    return im

base = img.copy()
for name, box in TIGHT_REGIONS.items():
    # Erase only the limb's own tight silhouette — the padding around it in
    # the piece's canvas is transparent and still needs the base's real
    # torso/hip pixels showing through underneath when unrotated.
    fill = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), bg)
    base.paste(fill, (box[0], box[1]))

for name, tight_box in TIGHT_REGIONS.items():
    padded_box = PADDED_REGIONS[name]
    canvas = Image.new("RGBA", (padded_box[2] - padded_box[0], padded_box[3] - padded_box[1]), (0, 0, 0, 0))
    limb_art = remove_background(img.crop(tight_box), bg)
    offset = (tight_box[0] - padded_box[0], tight_box[1] - padded_box[1])
    canvas.paste(limb_art, offset, limb_art)
    canvas.save(os.path.join(OUT_DIR, f"muscle-diagram-{name}.png"))

    px, py = PIVOTS[name]
    local_pivot = (px - padded_box[0], py - padded_box[1])
    w, h = padded_box[2] - padded_box[0], padded_box[3] - padded_box[1]
    print(f"{name}: canvas {w}x{h}, local pivot {local_pivot}")

base.save(os.path.join(OUT_DIR, "muscle-diagram-base.png"))

# Reconstruction sanity check: pasting the (unrotated) padded pieces back at
# their own offset should still reconstruct the original image exactly,
# since everything outside the tight silhouette in each piece is transparent.
recon = base.copy()
for name, padded_box in PADDED_REGIONS.items():
    piece = Image.open(os.path.join(OUT_DIR, f"muscle-diagram-{name}.png"))
    recon.paste(piece, (padded_box[0], padded_box[1]), piece)
recon.save(os.path.join(OUT_DIR, "_reconstruction_check.png"))

print("Done. Wrote base + 4 padded limb pieces to", OUT_DIR)
print("Delete _reconstruction_check.png after visually confirming it matches muscle-diagram.png.")
