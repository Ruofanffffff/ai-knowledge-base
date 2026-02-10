from PIL import Image
import os

def create_icon_with_padding(input_path, output_path, size):
    """
    创建带透明边距的图标，让logo居中
    
    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径
        size: 输出图片尺寸（正方形）
    """
    # 打开原始图片
    img = Image.open(input_path)
    
    # 确保图片有透明通道
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # 计算缩放比例，保持原始宽高比
    original_width, original_height = img.size
    
    # 计算logo的缩放尺寸（占图标的60%）
    logo_size = int(size * 0.6)
    
    # 计算缩放比例
    scale = min(logo_size / original_width, logo_size / original_height)
    
    # 缩放图片
    new_width = int(original_width * scale)
    new_height = int(original_height * scale)
    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # 创建新的透明背景图片
    new_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # 计算居中位置
    x = (size - new_width) // 2
    y = (size - new_height) // 2
    
    # 将logo粘贴到中心
    new_img.paste(img, (x, y), img)
    
    # 保存图片
    new_img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

# 基础路径
base_path = "client/resources"
icon_small = os.path.join(base_path, "icon-small.png")

# 为每个密度创建带边距的图标
densities = [
    ("mdpi", 48),
    ("hdpi", 72),
    ("xhdpi", 96),
    ("xxhdpi", 144),
    ("xxxhdpi", 192),
]

print("Creating icons with padding...")

for density, size in densities:
    # 创建ic_launcher.png
    output_path = os.path.join(base_path, f"icon-{density}.png")
    create_icon_with_padding(icon_small, output_path, size)
    
    # 创建ic_launcher_foreground.png
    output_path_fg = os.path.join(base_path, f"icon-foreground-{density}.png")
    create_icon_with_padding(icon_small, output_path_fg, size)

print("\nAll icons created successfully!")
