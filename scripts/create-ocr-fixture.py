from PIL import Image, ImageDraw, ImageFont

image = Image.new("RGB", (1200, 300), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 54)
draw.text((40, 45), "Fractions: 1/4 + 2/4 = 3/4", fill="black", font=font)
draw.text((40, 145), "Lesson 1 - Mathematics", fill="black", font=font)
image.save("/tmp/bisalasa-ocr-fixture.png")
