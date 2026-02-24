from PIL import Image

def remove_white_background(input_path, output_path):
    img = Image.open(input_path)
    
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        if item[0] > 230 and item[1] > 230 and item[2] > 230:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    img.save(output_path, 'PNG')
    print(f"Processed: {input_path} -> {output_path}")

if __name__ == '__main__':
    input_file = '/Users/ruofanfeng/Documents/trae_projects/client/src/assets/600cc0a2e59f846c93e6529bc524d2ae023eb689.png'
    output_file = '/Users/ruofanfeng/Documents/trae_projects/client/src/assets/600cc0a2e59f846c93e6529bc524d2ae023eb689.png'
    remove_white_background(input_file, output_file)