"""Cut a full-page screenshot into viewport-sized tiles for design review: tile-shots.py <png> <tile-height>"""
import sys
from PIL import Image

path, height = sys.argv[1], int(sys.argv[2])
image = Image.open(path)
for index, top in enumerate(range(0, image.height, height)):
    tile = image.crop((0, top, image.width, min(top + height, image.height)))
    tile.save(path.replace(".png", f".t{index:02d}.png"))
print(image.size, (image.height + height - 1) // height, "tiles")
