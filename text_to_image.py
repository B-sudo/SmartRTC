import os
import torch
from diffusers import StableDiffusionPipeline, EulerDiscreteScheduler

import sys

prompt = sys.argv[1]
room_id = sys.argv[2]

model_id = "stabilityai/stable-diffusion-2"
scheduler = EulerDiscreteScheduler.from_pretrained(model_id, subfolder="scheduler")
pipe = StableDiffusionPipeline.from_pretrained(model_id, scheduler=scheduler, torch_dtype=torch.float16)
pipe = pipe.to("cuda")

image = pipe(prompt).images[0]

save_dir = "public/assets/{}".format(room_id)
os.makedirs(save_dir, exist_ok=True)
if len(os.listdir(save_dir)) == 0:
    file_name = -1
else:
    file_name = sorted(os.listdir(save_dir))[-1].split(".")[0]

save_url = os.path.join(save_dir, f"{int(file_name)+1}.jpg".zfill(8))
image.save(save_url)

read_url= os.path.join("assets/{}".format(room_id), f"{int(file_name)+1}.jpg".zfill(8))
print(read_url)