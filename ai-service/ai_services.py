from flask import Flask, request, jsonify
import speech_recognition as sr
import os
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
    # --- Hoa quả ---
    "banana": "chuối",
    "apple": "táo",
    "orange": "cam",
    
    # --- Rau củ ---
    "broccoli": "súp lơ",
    "carrot": "cà rốt",
    "potted plant": "rau xanh", 
    
    # --- Thực phẩm chế biến sẵn ---
    "sandwich": "bánh mì kẹp",
    "hot dog": "xúc xích",
    "pizza": "bánh pizza",
    "donut": "bánh donut",
    "cake": "bánh ngọt",
    
    # --- Thịt (Model mặc định không có class 'meat', phải map từ động vật) ---
    "bird": "thịt gà",  # YOLO nhận gà sống/gà quay là bird
    "fresh": "thịt lợn", 
    "frozen": "thịt lợn",
    "racid" : "thịt lợn", # 
    "sheep": "thịt cừu",
    "cow": "thịt",
    "fish": "cá"

    # dữ liệu train mới
    
}

# --- TẢI NGUYÊN LIỆU ĐỘNG TỪ BACKEND NODE.JS ---
INGREDIENT_WHITELIST = set()

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
                INGREDIENT_WHITELIST.update([ing.lower() for ing in db_ingredients])
                print(f"✅ Đã tải thành công {len(db_ingredients)} nguyên liệu từ DB.")
                # Thêm cả các nguyên liệu từ map ảnh để đảm bảo đồng bộ
                hardcoded_ingredients = {name_vi.lower() for name_vi in VALID_INGREDIENTS_MAP.values()}
                INGREDIENT_WHITELIST.update(hardcoded_ingredients)
                print(f"✅ Tổng số nguyên liệu trong whitelist: {len(INGREDIENT_WHITELIST)}")
                return # Thoát khỏi hàm nếu thành công
            else:
                print(f"⚠️ Lỗi tải nguyên liệu từ backend. Status: {response.status_code}. Thử lại sau {retry_delay} giây...")
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Không thể kết nối tới backend để tải nguyên liệu: {e}. Thử lại sau {retry_delay} giây...")
        
        time.sleep(retry_delay)
    
    print("❌ Không thể tải danh sách nguyên liệu sau nhiều lần thử. Dịch vụ giọng nói có thể không chính xác.")

# --- KẾT THÚC TẢI ĐỘNG ---

# Load Model
print("Đang tải model YOLOv8...")
model = YOLO('yolov8n.pt') 
print("Model đã sẵn sàng!")

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
    
    try:
        if not convert_to_wav(original_path, wav_path):
             return jsonify({"error": "Lỗi định dạng âm thanh server."}), 500

        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            try:
                text = recognizer.recognize_google(audio_data, language="vi-VN").lower()
            except sr.UnknownValueError:
                text = ""
            
            # --- LOGIC MỚI: DÙNG WHITELIST ĐỘNG ---
            found_ingredients = set()
            if INGREDIENT_WHITELIST:
                 for ingredient in INGREDIENT_WHITELIST:
                    # Kiểm tra chính xác từ, tránh trường hợp "bò" khớp với "thịt bò"
                    # Bằng cách thêm khoảng trắng xung quanh
                    if f" {ingredient} " in f" {text} ":
                        found_ingredients.add(ingredient)
                    # Kiểm tra ở đầu câu
                    elif text.startswith(ingredient + " "):
                        found_ingredients.add(ingredient)
                    # Kiểm tra ở cuối câu
                    elif text.endswith(" " + ingredient):
                        found_ingredients.add(ingredient)
                    # Kiểm tra trường hợp câu chỉ có đúng 1 từ là nguyên liệu
                    elif text == ingredient:
                        found_ingredients.add(ingredient)

            
            keywords = list(found_ingredients)
        
        # Cleanup
        if os.path.exists(original_path): os.remove(original_path)
        if os.path.exists(wav_path): os.remove(wav_path)

        return jsonify({
            "raw_text": text,
            "detected_ingredients": keywords, 
            "status": "success"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
                name_en = model.names[cls_id] # Tên gốc tiếng Anh
                
                # --- LOGIC LỌC NGHIÊM NGẶT (WHITELIST) ---
                # Chỉ lấy nếu có trong danh sách đồ ăn
                if name_en in VALID_INGREDIENTS_MAP:
                    name_vi = VALID_INGREDIENTS_MAP[name_en]
                    detected_ingredients.add(name_vi)
                else:
                    # Ghi lại những thứ bị loại (người, xe, dao...) để debug
                    ignored_items.append(name_en)

        if os.path.exists(filepath): os.remove(filepath)

        return jsonify({
            "status": "success",
            "detected_ingredients": list(detected_ingredients),
            "debug_ignored": list(set(ignored_items)) # Trả về để bạn biết AI đã nhìn thấy gì nhưng bị chặn
        })

    except Exception as e:
            # Code xử lý lỗi chuẩn (đã sửa)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)