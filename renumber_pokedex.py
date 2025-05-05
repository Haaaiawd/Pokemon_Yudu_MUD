import json

# 定义 JSON 文件路径
file_path = 'g:\\Pokemon_data\\Pokemon_Yudu_MUD\\yudu_pokedex.json'

# 读取 JSON 数据
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        pokedex_data = json.load(f)
except FileNotFoundError:
    print(f"错误：文件未找到 {file_path}")
    exit()
except json.JSONDecodeError:
    print(f"错误：无法解析 JSON 文件 {file_path}")
    exit()

# 检查数据是否为列表
if not isinstance(pokedex_data, list):
    print(f"错误：JSON 文件的顶层结构不是列表 {file_path}")
    exit()

# 重新编号 yudex_id
new_index = 1
for pokemon in pokedex_data:
    if isinstance(pokemon, dict) and 'yudex_id' in pokemon:
        pokemon['yudex_id'] = f"Y{new_index:04d}"
        new_index += 1
    else:
        print(f"警告：跳过无效的条目或缺少 'yudex_id' 的条目: {pokemon}")

# 将更新后的数据写回文件
try:
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(pokedex_data, f, ensure_ascii=False, indent=4)
    print(f"成功重新编号并更新文件：{file_path}")
except IOError as e:
    print(f"错误：写入文件时出错 {file_path}: {e}")