from flask import Flask, request, jsonify
import speech_recognition as sr
import os
import re
import unicodedata
from ultralytics import YOLO
from pydub import AudioSegment 

app = Flask(__name__)

# --- CẤU HÌNH ---
UPLOAD_FOLDER = './temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

import requests
import time

# --- CẤU HÌNH DANH SÁCH NGUYÊN LIỆU (WHITELIST) ---
# Map này vẫn cần cho xử lý HÌNH ẢNH (ánh xạ tên class YOLO tiếng Anh -> tiếng Việt)
VALID_INGREDIENTS_MAP = {
    # Map theo dữ liệu ingredient mới trong DB
    "banana": "Chuối",
    "apple": "Táo",
    "orange": "Cam",
    "broccoli": "Súp lơ xanh",
    "carrot": "Cà rốt",
    "potted plant": "Rau muống",
    "sandwich": "Bánh mì",
    "bird": "Thịt gà ức",
    "cow": "Thịt bò nạc",
    "fish": "Cá",
}

# Alias giúp match giọng nói gần đúng với tên chuẩn trong DB.
VOICE_INGREDIENT_ALIASES = {
    "Thịt gà ức": ["thịt gà", "ức gà", "gà"],
    "Thịt bò nạc": ["thịt bò", "bò nạc", "bò"],
    "Thịt heo ba chỉ": ["thịt heo", "thịt lợn", "ba chỉ"],
    "Súp lơ xanh": ["súp lơ", "bông cải", "bông cải xanh"],
    "Đậu phụ": ["đậu hũ", "tàu hũ"],
    "Hành lá": ["hành hoa"],
    "Cải thìa": ["cải chíp"],
    "Bánh mì": ["bánh mỳ"],
    "Ớt": ["ớt tươi"],
}

# --- TẢI NGUYÊN LIỆU ĐỘNG TỪ BACKEND NODE.JS ---
def build_fallback_whitelist():
    fallback = set(VALID_INGREDIENTS_MAP.values())
    fallback.update(VOICE_INGREDIENT_ALIASES.keys())
    return {item.strip() for item in fallback if str(item).strip()}


INGREDIENT_WHITELIST = build_fallback_whitelist()
VOICE_ALIAS_TO_CANONICAL = {}
VOICE_MATCHERS = []


def normalize_text(text):
    if not text:
        return ""

    lowered = str(text).strip().lower()
    no_accent = unicodedata.normalize("NFD", lowered)
    no_accent = "".join(ch for ch in no_accent if unicodedata.category(ch) != "Mn")
    only_text = re.sub(r"[^a-z0-9\s]", " ", no_accent)
    return re.sub(r"\s+", " ", only_text).strip()


def rebuild_voice_matchers():
    global VOICE_ALIAS_TO_CANONICAL
    global VOICE_MATCHERS

    alias_map = {}

    for ingredient in INGREDIENT_WHITELIST:
        norm_name = normalize_text(ingredient)
        if norm_name:
            alias_map[norm_name] = ingredient

    for canonical_name, aliases in VOICE_INGREDIENT_ALIASES.items():
        if canonical_name not in INGREDIENT_WHITELIST:
            continue

        norm_canonical = normalize_text(canonical_name)
        if norm_canonical:
            alias_map[norm_canonical] = canonical_name

        for alias in aliases:
            norm_alias = normalize_text(alias)
            if norm_alias:
                alias_map[norm_alias] = canonical_name

    VOICE_ALIAS_TO_CANONICAL = alias_map
    VOICE_MATCHERS = [
        (re.compile(rf"(^|\s){re.escape(alias)}(?=\s|$)"), canonical)
        for alias, canonical in sorted(alias_map.items(), key=lambda item: len(item[0]), reverse=True)
    ]

def load_ingredients_from_backend():
    global INGREDIENT_WHITELIST
    max_retries = 3
    retry_delay = 5 # seconds
    
    for attempt in range(max_retries):
        print("Đang tải danh sách nguyên liệu từ backend Node.js...")
        try:
            response = requests.get('http://localhost:3000/api/internal/all-ingredients', timeout=10)
            if response.status_code == 200:
                db_ingredients = response.json()
                INGREDIENT_WHITELIST.clear()

                if isinstance(db_ingredients, list):
                    for item in db_ingredients:
                        if isinstance(item, str):
                            cleaned = item.strip()
                            if cleaned:
                                INGREDIENT_WHITELIST.add(cleaned)
                        elif isinstance(item, dict) and item.get("name"):
                            cleaned = str(item.get("name")).strip()
                            if cleaned:
                                INGREDIENT_WHITELIST.add(cleaned)

                print(f"✅ Đã tải thành công {len(db_ingredients)} nguyên liệu từ DB.")
                # Thêm cả các nguyên liệu từ map ảnh để đảm bảo đồng bộ
                hardcoded_ingredients = set(VALID_INGREDIENTS_MAP.values())
                INGREDIENT_WHITELIST.update(hardcoded_ingredients)

                rebuild_voice_matchers()
                print(f"✅ Tổng số nguyên liệu trong whitelist: {len(INGREDIENT_WHITELIST)}")
                return # Thoát khỏi hàm nếu thành công
            else:
                print(f"⚠️ Lỗi tải nguyên liệu từ backend. Status: {response.status_code}. Thử lại sau {retry_delay} giây...")
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Không thể kết nối tới backend để tải nguyên liệu: {e}. Thử lại sau {retry_delay} giây...")
        
        time.sleep(retry_delay)
    
    fallback = build_fallback_whitelist()
    INGREDIENT_WHITELIST.update(fallback)
    rebuild_voice_matchers()
    print(
        f"❌ Không thể tải danh sách nguyên liệu sau nhiều lần thử. "
        f"Đã dùng fallback cục bộ ({len(INGREDIENT_WHITELIST)} nguyên liệu)."
    )

# --- KẾT THÚC TẢI ĐỘNG ---

# Load Model
print("Đang tải model YOLOv8...")
model = YOLO('yolov8n.pt') 
print("Model đã sẵn sàng!")

# Khởi tạo matcher tối thiểu trước, tránh whitelist rỗng khi backend chưa sẵn sàng.
rebuild_voice_matchers()

# Tải danh sách nguyên liệu ngay khi khởi động
load_ingredients_from_backend()

# --- HÀM HỖ TRỢ: CHUYẨN ĐỔI AUDIO ---
def convert_to_wav(input_path, output_path):
    try:
        sound = AudioSegment.from_file(input_path)
        sound = sound.set_channels(1) 
        sound.export(output_path, format="wav")
        return True
    except Exception as e:
        print(f"Lỗi convert audio: {e}")
        return False

# --- API 1: XỬ LÝ GIỌNG NÓI (ĐÃ NÂNG CẤP) ---
@app.route('/detect/voice', methods=['POST'])
def detect_voice():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    original_filename = file.filename if file.filename else "temp_audio"
    original_path = os.path.join(UPLOAD_FOLDER, original_filename)
    file.save(original_path)
    
    wav_path = os.path.join(UPLOAD_FOLDER, "converted_audio.wav")
    recognizer = sr.Recognizer()
    
    text = ""
    keywords = []

    try:
        if not convert_to_wav(original_path, wav_path):
             return jsonify({"error": "Lỗi định dạng âm thanh server."}), 500

        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            try:
                text = recognizer.recognize_google(audio_data, language="vi-VN")
            except sr.UnknownValueError:
                text = ""
            
            # --- LOGIC MỚI: DÙNG WHITELIST ĐỘNG ---
            found_ingredients = set()
            if VOICE_MATCHERS:
                normalized_text = normalize_text(text)
                for pattern, canonical_name in VOICE_MATCHERS:
                    if pattern.search(normalized_text):
                        found_ingredients.add(canonical_name)

            keywords = sorted(found_ingredients)

        return jsonify({
            "raw_text": str(text).lower(),
            "detected_ingredients": keywords, 
            "status": "success"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(original_path):
            try:
                os.remove(original_path)
            except OSError:
                pass
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except OSError:
                pass

# --- API 2: XỬ LÝ ẢNH (ĐÃ LỌC SẠCH SẼ) ---
@app.route('/detect/image', methods=['POST'])
def detect_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    filename = file.filename
    if not filename or '.' not in filename: filename = "temp_image.jpg"
    
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # conf=0.35: Độ tin cậy trên 35% mới lấy (để tránh nhận diện rác)
        results = model.predict(source=filepath, conf=0.35, save=False)
        
        detected_ingredients = set()
        ignored_items = [] # Debug: xem nó loại bỏ cái gì

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                name_en = model.names[cls_id] 
                
                # --- LOGIC LỌC NGHIÊM NGẶT (WHITELIST) ---
                # Chỉ lấy nếu có trong danh sách đồ ăn
                if name_en in VALID_INGREDIENTS_MAP:
                    name_vi = VALID_INGREDIENTS_MAP[name_en]
                    if name_vi in INGREDIENT_WHITELIST:
                        detected_ingredients.add(name_vi)
                    else:
                        normalized = normalize_text(name_vi)
                        canonical = VOICE_ALIAS_TO_CANONICAL.get(normalized)
                        if canonical:
                            detected_ingredients.add(canonical)
                        else:
                            ignored_items.append(name_en)
                else:
                    # Ghi lại những thứ bị loại (người, xe, dao...) để debug
                    ignored_items.append(name_en)

        return jsonify({
            "status": "success",
            "detected_ingredients": list(detected_ingredients),
            "debug_ignored": list(set(ignored_items)) # Trả về để bạn biết AI đã nhìn thấy gì nhưng bị chặn
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass

if __name__ == '__main__':
    ai_port = int(os.getenv('AI_SERVICE_PORT', '5000'))
    ai_debug = os.getenv('AI_SERVICE_DEBUG', '0').strip() in ('1', 'true', 'True')
    app.run(host='0.0.0.0', port=ai_port, debug=ai_debug, use_reloader=False)