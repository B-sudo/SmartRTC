import os
import torch
from diffusers import StableDiffusionPipeline, EulerDiscreteScheduler

import sys

prompt = sys.argv[1]

model_id = "stabilityai/stable-diffusion-2"
scheduler = EulerDiscreteScheduler.from_pretrained(model_id, subfolder="scheduler")
pipe = StableDiffusionPipeline.from_pretrained(model_id, scheduler=scheduler, torch_dtype=torch.float16)
pipe = pipe.to("cuda")

image = pipe(prompt).images[0]

os.makedirs("public/assets", exist_ok=True)
if len(os.listdir("assets")) == 0:
    file_name = -1
else:
    file_name = sorted(os.listdir("public/assets"))[-1].split(".")[0]

save_url = os.path.join("public/assets", f"{int(file_name)+1}.jpg".zfill(8))
image.save(save_url)

print(save_url)