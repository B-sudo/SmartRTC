## Deploy npm environment

npm init -y

npm install ws

npm install express --save

npm install archiver

npm install fs


## Install Python Environment

The project requires GPUs.

Install needed packages:

```shell
# use conda
conda create --name smartRTC python=3.8
conda activate smartRTC

conda install pytorch torchvision torchaudio pytorch-cuda=11.8 -c pytorch -c nvidia 
pip install diffusers["torch"] transformers
pip install Pillow
```
Feel free to change the python version. 

Note that in the first time running it will download pre-trained model weights automatically.

## Launch Signaling Server

Notice: You may want to modify the server URL in public/app.js to your server address.

node websocket-server.js