npm init -y

npm install ws

npm install express --save

npm install archiver

node websocket-server.js


## Install Python Environment

Install needed packages:

```shell
# use conda
conda create --name smartRTC python=3.8
conda activate smartRTC

conda install pytorch torchvision torchaudio pytorch-cuda=11.8 -c pytorch -c nvidia 
pip install diffusers["torch"] transformers
```
Feel free to change the python version. 

Note that in the first time running it will download pre-trained model weights automatically.