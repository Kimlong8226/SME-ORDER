import sys
import os

# 将 backend 根目录添加到 Python 模块搜索路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
