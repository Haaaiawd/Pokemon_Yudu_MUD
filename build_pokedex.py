import os
import json

def build_yudu_pokedex():
    source_dir = r'g:\Pokemon_data\Pokemon_Yudu_MUD\data\pokemon'
    output_file = r'g:\Pokemon_data\Pokemon_Yudu_MUD\yudu_pokedex.json'
    pokedex_data = []

    print(f"Starting to process files from: {source_dir}")

    try:
        filenames = os.listdir(source_dir)
    except FileNotFoundError:
        print(f"Error: Source directory not found: {source_dir}")
        return
    except Exception as e:
        print(f"Error listing directory {source_dir}: {e}")
        return

    for filename in filenames:
        if filename.endswith('.json'):
            # Extract ID from filename (e.g., '0001-妙蛙种子.json' -> '0001')
            if len(filename) >= 4 and filename[:4].isdigit():
                numeric_id = filename[:4]
                yudex_id = f"Y{numeric_id}"
            else:
                print(f"Warning: Skipping file with unexpected name format: {filename}")
                continue

            file_path = os.path.join(source_dir, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Extract required fields, providing defaults if keys are missing
                name = data.get('name', '')
                name_en = data.get('name_en', '')
                name_jp = data.get('name_jp', '')

                pokemon_entry = {
                    "yudex_id": yudex_id,
                    "name": name,
                    "name_en": name_en,
                    "name_jp": name_jp,
                    "world_gen": "Y"  # Set world_gen to 'Y' as requested
                }
                pokedex_data.append(pokemon_entry)

            except FileNotFoundError:
                print(f"Warning: File not found during processing: {file_path}")
            except json.JSONDecodeError:
                print(f"Warning: Error decoding JSON from file: {file_path}")
            except Exception as e:
                print(f"Warning: An unexpected error occurred processing file {file_path}: {e}")

    # Sort the data by yudex_id before writing
    pokedex_data.sort(key=lambda x: x['yudex_id'])

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(pokedex_data, f, ensure_ascii=False, indent=4)
        print(f"Successfully created pokedex file: {output_file}")
    except Exception as e:
        print(f"Error writing output file {output_file}: {e}")

if __name__ == "__main__":
    build_yudu_pokedex()