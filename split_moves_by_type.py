import json
import os
from collections import defaultdict
import sys # Needed for __file__ when run directly

# --- Configuration ---
import os
import sys # Needed for __file__ when run directly

try:
    # Get the absolute path of the directory containing the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
except NameError:
     # __file__ is not defined if run in certain interactive environments, use cwd as fallback
     script_dir = os.getcwd()
     print("Warning: __file__ not defined, using current working directory as script directory. "
           "Ensure the script is run from the 'Pokemon_Yudu_MUD' directory.")


# Assuming the script is located directly inside the Pokemon_Yudu_MUD directory
PROJECT_ROOT = script_dir # If script is in Pokemon_Yudu_MUD root

# Construct paths relative to the project root
INPUT_JSON_PATH = os.path.join(PROJECT_ROOT, 'data', 'move_list.json')
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'data', 'move_lists_by_type')
# --- End Configuration ---

def split_moves():
    """
    Reads move_list.json, extracts move names by type, and writes them
    to separate .txt files in the output directory.
    """
    print(f"Starting move list splitting process...")
    print(f"Input JSON path: {os.path.abspath(INPUT_JSON_PATH)}")
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}")

    # 1. Create output directory if it doesn't exist
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        print(f"Ensured output directory exists: {OUTPUT_DIR}")
    except OSError as e:
        print(f"Error creating directory {OUTPUT_DIR}: {e}")
        return

    # 2. Read and parse the input JSON file
    try:
        with open(INPUT_JSON_PATH, 'r', encoding='utf-8') as f:
            all_moves = json.load(f)
        print(f"Successfully read and parsed {INPUT_JSON_PATH}")
    except FileNotFoundError:
        print(f"Error: Input file not found at {INPUT_JSON_PATH}")
        print("Please ensure move_list.json is in the 'data' directory and the script is run from the 'Pokemon_Yudu_MUD' directory.")
        return
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {INPUT_JSON_PATH}: {e}")
        return
    except Exception as e:
        print(f"An unexpected error occurred while reading the file: {e}")
        return

    # 3. Categorize moves by type
    moves_by_type = defaultdict(list)
    missing_type_count = 0
    missing_name_count = 0

    if not isinstance(all_moves, list):
        print("Error: Expected the root of move_list.json to be a list of move objects.")
        return

    for move in all_moves:
        if not isinstance(move, dict):
            print(f"Warning: Skipping non-dictionary item in move list: {move}")
            continue

        move_type = move.get('type')
        move_name = move.get('name')

        if not move_type:
            # print(f"Warning: Move missing 'type' field: {move}")
            missing_type_count += 1
            continue # Skip moves without a type

        if not move_name:
            # print(f"Warning: Move missing 'name' field: {move}")
            missing_name_count += 1
            # Decide if you want to skip or use an ID/placeholder
            continue # Skip moves without a name for now

        moves_by_type[move_type].append(move_name)

    if missing_type_count > 0:
         print(f"Warning: Skipped {missing_type_count} moves due to missing 'type' field.")
    if missing_name_count > 0:
         print(f"Warning: Skipped {missing_name_count} moves due to missing 'name' field.")


    print(f"Categorized moves into {len(moves_by_type)} types.")

    # 4. Write categorized move names to separate files
    written_files_count = 0
    for move_type, move_names in moves_by_type.items():
        # Sanitize filename (replace potentially problematic characters if any)
        safe_filename = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in move_type) + ".txt"
        output_filepath = os.path.join(OUTPUT_DIR, safe_filename)

        try:
            with open(output_filepath, 'w', encoding='utf-8') as f:
                for name in move_names:
                    f.write(f"{name}\n")
            # print(f"Written {len(move_names)} moves to {output_filepath}")
            written_files_count += 1
        except IOError as e:
            print(f"Error writing to file {output_filepath}: {e}")
        except Exception as e:
             print(f"An unexpected error occurred while writing file {safe_filename}: {e}")


    print(f"\nProcess finished. Successfully wrote招式列表 for {written_files_count} types to '{OUTPUT_DIR}'.")

if __name__ == "__main__":
    split_moves()
