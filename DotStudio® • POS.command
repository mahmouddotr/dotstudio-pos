#!/bin/bash
cd "/Users/dot/Desktop/BRTFOLIO/DotStudio® - POS-OLD/DotStudio_APPLE_FINAL"
python3 -m http.server 8080 &
sleep 2
open "http://localhost:8080"
