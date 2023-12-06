import torch
from diffusers import StableDiffusionInstructPix2PixPipeline, EulerAncestralDiscreteScheduler
import os
import sys
from PIL import Image

image_file = sys.argv[1]
instruction = sys.argv[2]

image_file = os.path.join("public", image_file)
image = Image.open(image_file).convert('RGB')
model_id = "timbrooks/instruct-pix2pix"
pipe = StableDiffusionInstructPix2PixPipeline.from_pretrained(model_id, torch_dtype=torch.float16, safety_checker=None)
pipe.to("cuda")
pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
# `image` is an RGB PIL.Image
modified_image = pipe(instruction, image=image).images[0]

image_file_name = image_file.split("/")[-1]
new_imgae_file_name = f"{int(image_file_name.split('.')[0])+1}.jpg".zfill(8)
new_imgae_file = image_file.replace(image_file_name, new_imgae_file_name)

modified_image.save(new_imgae_file)

read_url = new_imgae_file.replace("public/", "")
print(read_url)