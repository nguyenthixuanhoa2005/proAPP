-- =======================================================
-- BƯỚC 1: DỌN DẸP DỮ LIỆU CŨ
-- =======================================================
TRUNCATE TABLE 
    audit_log, recommendation_log, user_preference,
    favorite_meal_set, meal_set_recipe, meal_set, favorite_recipe, rating,
    recipe_ingredient, recipe_step, recipe, ingredient,
    user_premium_history, payment, premium_plan,
    refresh_token, user_role, role, app_user 
RESTART IDENTITY 
CASCADE;
-- =======================================================
-- BƯỚC 2: INSERT DATA
-- =======================================================

--////////////////////////////
-- 4. USER 
INSERT INTO app_user (email, password_hash, full_name, status) VALUES 
('hoa@gmail.com', '123456', 'Nguyễn Thị Hoa', 'ACTIVE'),
('nam@gmail.com', '123456', 'Trần Văn Nam', 'ACTIVE'),
('lan@gmail.com', '123456', 'Lê Thị Lan', 'ACTIVE'),
('hung@gmail.com', '123456', 'Phạm Văn Hùng', 'ACTIVE'),
('mai@gmail.com', '123456', 'Hoàng Thị Mai', 'ACTIVE'),
('tuan@gmail.com', '123456', 'Vũ Anh Tuấn', 'ACTIVE'),
('cuc@gmail.com', '123456', 'Ngô Thu Cúc', 'BLOCKED'),
('truc@gmail.com', '123456', 'Đinh Thanh Trúc', 'ACTIVE'),
('minh@gmail.com', '123456', 'Lý Bình Minh', 'ACTIVE'),
('hieu@gmail.com', '123456', 'Trương Trung Hiếu', 'ACTIVE'),
('thao@gmail.com', '123456', 'Bùi Phương Thảo', 'ACTIVE'),
('dat@gmail.com', '123456', 'Đỗ Thành Đạt', 'DELETED'),
('linh@gmail.com', '123456', 'Dương Thùy Linh', 'ACTIVE'),
('quan@gmail.com', '123456', 'Hà Anh Quân', 'ACTIVE'),
('nhung@gmail.com', '123456', 'Phan Tuyết Nhung', 'ACTIVE'),
('son@gmail.com', '123456', 'Cao Thái Sơn', 'ACTIVE'),
('ha@gmail.com', '123456', 'Trịnh Thu Hà', 'ACTIVE'),
('phong@gmail.com', '123456', 'Lưu Thanh Phong', 'ACTIVE'),
('yenca@gmail.com', '123456', 'Nguyễn Hải Yến', 'ACTIVE'),
('duy@gmail.com', '123456', 'Trần Khánh Duy', 'ACTIVE'),
('nga@gmail.com', '123456', 'Phạm Quỳnh Nga', 'ACTIVE'),
('khoi@gmail.com', '123456', 'Hoàng Minh Khôi', 'ACTIVE'),
('vy@gmail.com', '123456', 'Vũ Tường Vy', 'ACTIVE'),
('thinh@gmail.com', '123456', 'Ngô Quốc Thịnh', 'ACTIVE'),
('tram@gmail.com', '123456', 'Đinh Bích Trâm', 'ACTIVE'),
('long@gmail.com', '123456', 'Lý Hoàng Long', 'ACTIVE'),
('khoe@gmail.com', '123456', 'Trương Mạnh Khỏe', 'ACTIVE'),
('ngoc@gmail.com', '123456', 'Bùi Bảo Ngọc', 'ACTIVE'),
('phuc@gmail.com', '123456', 'Đỗ Tấn Phúc', 'ACTIVE'),
('quyen@gmail.com', '123456', 'Dương Lệ Quyên', 'ACTIVE');

--///////////////////////////////

-- 1. ROLE
INSERT INTO role (role_name) VALUES 
('ADMIN'), ('USER'), ('PREMIUM_USER');
select * from role;

-- 2. PREMIUM PLAN
INSERT INTO premium_plan (plan_name, price, duration_days, description) VALUES 
('Gói Tuần', 20000, 7, 'Gói trải nghiệm'),
('Gói Tháng', 59000, 30, 'Gói phổ biến'),
('Gói Năm', 599000, 365, 'Gói tiết kiệm');
select * from premium_plan;

-- 5. USER ROLE
INSERT INTO user_role (user_id, role_id) VALUES 
(1, 1), (2, 2), (3, 2), (4, 2), (5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 2),
(11, 2), (12, 2), (13, 2), (14, 2), (15, 2), (16, 2), (17, 2), (18, 2), (19, 2), (20, 2),
(21, 2), (22, 2), (23, 2), (24, 2), (25, 2), (26, 2), (27, 2), (28, 2), (29, 2), (30, 2);

--/////////////////////////////////////


-- 3. INGREDIENT
INSERT INTO ingredient (name, type, is_common) VALUES 
('Thịt gà ức', 'MEAT', true),
('Thịt bò nạc', 'MEAT',  true),
('Thịt heo ba chỉ', 'MEAT', true),
('Cá hồi', 'MEAT', false),
('Tôm sú', 'MEAT',  true),
('Trứng gà', 'OTHER', true),
('Đậu phụ', 'OTHER', true),
('Gạo tẻ', 'STARCH',  true), 
('Gạo lứt', 'STARCH',false),
('Khoai tây', 'VEGETABLE',  true),
('Khoai lang', 'VEGETABLE', true),
('Cà rốt', 'VEGETABLE',true),
('Cà chua', 'VEGETABLE',true),
('Rau muống', 'VEGETABLE',  true),
('Súp lơ xanh', 'VEGETABLE',  true),
('Cải thìa', 'VEGETABLE', true),
('Hành tây', 'VEGETABLE', true),
('Tỏi', 'SPICE',  true),
('Ớt', 'SPICE', true),
('Gừng', 'SPICE', true),
('Muối', 'SPICE', true),
('Đường', 'SPICE',  true),
('Nước mắm', 'SPICE',  true),
('Dầu ăn', 'OTHER', true), 
('Dầu hào', 'SPICE', true),
('Táo', 'FRUIT', true),
('Chuối', 'FRUIT', true),
('Cam', 'FRUIT',  true),
('Bơ', 'FRUIT', false),
('Hành lá', 'VEGETABLE', true),
('Sả tươi', 'SPICE', true),
('Giá đỗ', 'VEGETABLE', true),
('Mướp đắng', 'VEGETABLE', true),
('Nấm kim châm', 'VEGETABLE', true),
('Cá thu', 'MEAT',  true),
('Mắm tôm', 'SPICE',  true),
('Tương ớt', 'SPICE', true),
('Yến mạch', 'STARCH',false), -- Xu hướng Healthy
('Hạt chia', 'OTHER', false), -- Xu hướng Healthy
('Bún tươi', 'STARCH',  true),
('Bánh mì', 'STARCH', true), 
('Trứng', 'OTHER', true), 
('Chanh', 'SPICE', true);

--DELETE FROM ingredient WHERE ingredient_id = 44;
select * from ingredient;

-- 7. RECIPE:-- cần bắt đkien trùng, chưa có id, tên món ch có trg list nguyên liệu
INSERT INTO recipe (author_id, title, description, ingredients_json, steps_json, dish_type, cooking_time, difficulty) VALUES 
-- Món 1: ức gà luộc 
(1, 'Ức gà', 'Món ức gà tươi ngon nhiều dinh dưỡng', 
'[{"id": 1, "name": "Thịt gà ức", "qty": 500, "unit": "g"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Làm sạch ức gà với nước"}, {"step": 2, "content": "Cho lên nồi đun 20"}, {"step": 3, "content": "Cho mắm vào" }, {"step": 4, "content": "Đợi 20 phút rồi cho ra đĩa"}]'::JSONB, 'MAIN_DISH', 40, 'EASY'),

-- Món 2: Thịt bò xào hành tây
(1, 'Thịt bò xào hành tây', 'Thịt bò xào hành tây siêu ngon', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 400, "unit": "g"}, {"id": 17, "name": "Hành tây", "qty": 1, "unit": "củ"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Sơ chế hành tây, thịt bò"}, {"step": 2, "content": "Xào hành tây gần chín"}, {"step": 3, "content": "Cho thịt bò vào đảo kèm mắm"}, {"step": 4, "content": "Xào khoảng 8 phút rồi cho ra đĩa"}]'::JSONB, 'MAIN_DISH', 25, 'EASY'),

-- Món 3: Thịt bò xào gừng
(1,  'Thịt bò xào gừng', 'Thịt bò xào gừng',
'[{"id": 2, "name": "Thịt bò nạc", "qty": 400, "unit": "g"}, {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}, {"id": 23, "name": "Nước mắm", "qty": 30, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Lạo vỏ gừng"}, {"step": 2, "content": "Cho gừng vào xào qua trước"}, {"step": 3, "content": "Cho thịt bò vào đảo kèm mắm"}, {"step": 4, "content": "Xào khoảng 8 phút rồi cho ra đĩa"}]'::JSONB, 'MAIN_DISH', 20, 'MEDIUM'),

-- Món 4: Trứng chiên hành
(1, 'Trứng chiên hành', 'Món ăn nhanh gọn', 
'[{"id": 42, "name": "Trứng", "qty": 3, "unit": "quả"}, {"id": 30, "name": "Hành lá", "qty": 2, "unit": "nhánh"}, {"id": 21, "name": "Muối", "qty": 1, "unit": "thìa"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"} ]'::JSONB,
'[{"step": 1, "content": "Đánh trứng kèm hành lá và muối"},{"step": 2, "content": "Cho dầu ăn vào chờ tầm 2 phút"}, {"step": 3, "content": "Cho trứng vào chảo"}, {"step": 4, "content": "Chờ 2 phút rồi lật trứng"},{"step": 4, "content": "Chờ thêm 2 phút rồi cho ra đĩa"}]'::JSONB, 'SIDE_DISH', 10, 'EASY'),

-- Món 5: Cá hồi áp chảo
(1, 'Cá hồi áp chảo', 'Món ăn sang trọng', 
'[{"id": 4, "name": "Cá hồi", "qty": 200, "unit": "g"}, {"id": 43, "name": "Chanh", "qty": 0.5, "unit": "quả"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Cho dầu ăn vào đợi khoảng 1 phút"},{"step": 2, "content": "Cho cá vào áp chảo"}, {"step": 3, "content": "Chờ khoảng 2 phút rồi lật lại"},  {"step": 4, "content": "Chờ 2 phút cho chín rồi mang ra đĩa và vắt chanh"}]'::JSONB, 'MAIN_DISH', 15, 'MEDIUM'),

-- Món 6: Thịt bò hầm cà rốt
(1, 'Bò hầm cà rốt', 'Món bò hầm mềm', 
'[{"id": 2, "name": "Thịt bò nạc", "qty": 500, "unit": "g"}, {"id": 12, "name": "Cà rốt", "qty": 2, "unit": "củ"}, {"id": 21, "name": "Muối", "qty": 1, "unit": "thìa"}]'::JSONB,
'[{"step": 1, "content": "Ướp bò với muối tầm 30 đến 40 phút"}, {"step": 2, "content": "Hầm với cà rốt tầm 2 đến 3 tiếng cho nhừ"}]'::JSONB, 'MAIN_DISH', 90, 'HARD'),

-- Món 7: Salad cà rốt chanh
(1, 'Salad cà rốt chanh', 'Món khai vị giảm cân', 
'[{"id": 12, "name": "Cà rốt", "qty": 2, "unit": "củ"}, {"id": 43, "name": "Chanh", "qty": 0.5, "unit": "quả"}]'::JSONB,
'[{"step": 1, "content": "Lạo sạch cà rốt và rửa sạch"},{"step": 2, "content": "Bào sợi cà rốt"}, {"step": 3, "content": "Trộn nước cốt chanh"}]'::JSONB, 'SIDE_DISH', 10, 'EASY'),

-- Món 8: Nước chanh gừng
(1, 'Nước chanh gừng', 'Thức uống giải cảm', 
'[{"id": 43, "name": "Chanh", "qty": 1, "unit": "quả"},  {"id": 20, "name": "Gừng", "qty": 1, "unit": "củ"}]'::JSONB,
'[{"step": 1, "content": "Giã gừng"}, {"step": 2, "content": "Pha nước chanh"}, {"step": 3, "content": "Cho gừng vào nước chanh"}]'::JSONB, 'DRINK', 5, 'EASY'),

-- Món 9: Đậu rán
(1, 'Đậu rán', 'Món ăn đơn giản nhưng ngon siêu cấp', 
'[{"id": 7, "name": "Đậu phụ", "qty": 3, "unit": "cái"}, {"id": 24, "name": "Dầu ăn", "qty": 5, "unit": "ml"}]'::JSONB,
'[{"step": 1, "content": "Cắt đậu thành miếng vuông hoặc lát 3cm"},{"step": 2, "content": "Cho dầu ăn vào chảo chờ tầm 1 phút"}, {"step": 3, "content": "Cho đậu vào rán và lật khi chín"}]'::JSONB, 'MAIN_DISH', 30, 'EASY'),

-- Món 10: Bún đậu mắm tôm
(1, 'Bún đậu mắm tôm', 'Món bún đậu như tên', 
'[{"id": 7, "name": "Đậu phụ", "qty": 5, "unit": "cái"}, {"id": 24, "name": "Dầu ăn", "qty": 10, "unit": "ml"}, {"id": 36, "name": "Mắm tôm", "qty": 15, "unit": "ml"}, {"id": 40, "name": "Bún tươi", "qty": 1, "unit": "cân"}]'::JSONB,
'[{"step": 1, "content": "Cắt đậu thành miếng vuông hoặc lát 3cm"},{"step": 2, "content": "Cho dầu ăn vào chảo chờ tầm 1 phút"}, {"step": 3, "content": "Cho đậu vào rán và lật khi chín"},{"step": 4, "content": "Bày ra đĩa kèm mắm tôm và bún"}]'::JSONB, 'MAIN_DISH', 15, 'EASY');

select * from recipe;

--Map du lieu cac mon an va nguyen lieu
INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id) VALUES 
(1,1), (1,23), -- Món 1
(2,2), (2,17), (2,23), -- Món 2
(3,2), (3,20), (3, 23),         -- Món 3
(4,42), (4,30), (4,21) ,        -- Món 4
(5,4), (5,43), (5, 24)  ,      -- Món 5
(6,2), (6,12), (6, 21)   ,      -- Món 6
(7,12), (7,43),        -- Món 7
(8,43), (8,20),        -- Món 8
(9,7), (9, 24),               -- Món 9
(10,7), (10,24), (10, 36), (10, 40);       -- Món 10

-- 10. MEAL SET
INSERT INTO meal_set (name, target_calories, meal_type, user_id, goal_type) values
('Thực đơn 1', 1500, 'DAILY', 2, 'LOSE_WEIGHT'), ('Thực đơn 2', 2500, 'DAILY', 4, 'GAIN_WEIGHT'),
('Thực đơn 3', 1800, 'DAILY', 1, 'MAINTAIN'), ('Thực đơn 4', 700, 'LUNCH', 3, 'MAINTAIN'),
('Thực đơn 5', 500, 'BREAKFAST', 5, 'MAINTAIN'), ('Thực đơn 6', 1600, 'DAILY', 7, 'MAINTAIN'),
('Thực đơn 7', 1400, 'DAILY', 6, 'LOSE_WEIGHT'), ('Thực đơn 8', 400, 'DINNER', 8, 'LOSE_WEIGHT'),
('Thực đơn 9', 3000, 'DAILY', 9, 'GAIN_WEIGHT'), ('Thực đơn 10', 1200, 'DAILY', 11, 'LOSE_WEIGHT'),
('Thực đơn 11', 2000, 'DAILY', 10, 'MAINTAIN'), ('Thực đơn 12', 1500, 'DAILY', 12, 'LOSE_WEIGHT'),
('Thực đơn 13', 2200, 'DAILY', 14, 'GAIN_WEIGHT'), ('Thực đơn 14', 300, 'SNACK', 15, 'MAINTAIN'),
('Thực đơn 15', 2800, 'DAILY', 18, 'GAIN_WEIGHT'), ('Thực đơn 16', 1400, 'DAILY', 16, 'LOSE_WEIGHT'),
('Thực đơn 17', 1900, 'DAILY', 20, 'MAINTAIN'), ('Thực đơn 18', 1800, 'DAILY', 21, 'MAINTAIN'),
('Thực đơn 19', 1700, 'DAILY', 22, 'MAINTAIN'), ('Thực đơn 20', 2500, 'DINNER', 23, 'MAINTAIN'),
('Thực đơn 21', 2000, 'LUNCH', 24, 'MAINTAIN'), ('Thực đơn 22', 1800, 'DAILY', 1, 'MAINTAIN'),
('Thực đơn 23', 1450, 'DAILY', 2, 'LOSE_WEIGHT'), ('Thực đơn 24', 2600, 'DAILY', 4, 'GAIN_WEIGHT'),
('Thực đơn 25', 1500, 'DAILY', 3, 'MAINTAIN'), ('Thực đơn 26', 600, 'BREAKFAST', 14, 'GAIN_WEIGHT'),
('Thực đơn 27', 500, 'DINNER', 16, 'LOSE_WEIGHT'), ('Thực đơn 28', 1700, 'DAILY', 19, 'MAINTAIN'),
('Thực đơn 29', 2100, 'DAILY', 25, 'GAIN_WEIGHT'), ('Thực đơn 30', 2200, 'DAILY', 30, 'MAINTAIN'), 
('Thực đơn 31', 350, 'BREAKFAST', 2, 'LOSE_WEIGHT'),('Thực đơn 32', 600, 'DINNER', 3, 'MAINTAIN');

-- 11. MEAL SET RECIPE: CHƯA CHẠY
INSERT INTO meal_set_recipe (meal_set_id, recipe_id) VALUES
(1, 8), (2, 7), (3, 1), (4, 5), (5, 27), (6, 4), (7, 13), (8, 20), (9, 9), (10, 21),
(11, 2), (12, 1), (13, 17), (14, 26), (15, 7), (16, 8), (17, 3), (18, 15), (19, 14), (20, 30),
(21, 28), (22, 13), (23, 8), (24, 18), (25, 4), (26, 9), (27, 20), (28, 11), (29, 6), (30, 29),
(30, 31), (32, 31), (31, 33); 

select * from meal_set_recipe;
-- 12. RATING
INSERT INTO rating (user_id, recipe_id, score, comment) VALUES
(1, 2, 5, 'Ngon'), (2, 1, 4, 'Ok'), (3, 5, 5, 'Tot'), (4, 7, 5, 'Good'), (5, 3, 3, 'Binh thuong'),
(6, 10, 4, 'Duoc'), (7, 8, 5, 'Thich'), (8, 12, 5, 'Ngon lam'), (9, 4, 2, 'Te'), (10, 6, 5, 'Xuat sac'),
(11, 9, 4, 'Ngon'), (12, 15, 5, 'De lam'), (13, 11, 4, 'Mat'), (14, 13, 5, 'Sang chanh'), (15, 14, 3, 'Nhat'),
(16, 20, 5, 'Bo'), (17, 18, 4, 'Mem'), (18, 22, 5, 'Tuoi'), (19, 21, 5, 'Beo'), (20, 25, 4, 'Deo'),
(21, 24, 5, 'Min'), (22, 23, 5, 'Ngot'), (23, 26, 4, 'Gion'), (24, 28, 5, 'Tien'), (25, 30, 5, 'Cay'),
(26, 29, 4, 'Dai'), (27, 27, 5, 'Nhanh'), (28, 19, 4, 'Ngot'), (29, 17, 5, 'Thom'), (30, 16, 4, 'Ngot');

-- 13. FAVORITE RECIPE
INSERT INTO favorite_recipe (user_id, recipe_id) VALUES
(1, 1), (1, 2), (2, 3), (2, 4), (3, 5), (3, 6), (4, 7), (4, 8), (5, 9), (5, 10),
(6, 11), (6, 12), (7, 13), (7, 14), (8, 15), (8, 16), (9, 17), (9, 18), (10, 19), (10, 20),
(11, 21), (11, 22), (12, 23), (12, 24), (13, 25), (13, 26), (14, 27), (14, 28), (15, 29), (15, 30);

-- 14. PAYMENT
INSERT INTO payment (user_id, plan_id, amount, payment_method, status, transaction_code, paid_at) VALUES
(1, 1, 20000, 'MOMO', 'SUCCESS', 'T1', NOW()), (2, 2, 59000, 'ZALO', 'SUCCESS', 'T2', NOW()),
(3, 3, 599000, 'VISA', 'SUCCESS', 'T3', NOW()), (4, 1, 20000, 'MOMO', 'SUCCESS', 'T4', NOW()),
(5, 2, 59000, 'ATM', 'SUCCESS', 'T5', NOW()), (6, 1, 20000, 'MOMO', 'SUCCESS', 'T6', NOW()),
(7, 3, 599000, 'VISA', 'SUCCESS', 'T7', NOW()), (8, 2, 59000, 'ZALO', 'SUCCESS', 'T8', NOW()),
(9, 1, 20000, 'MOMO', 'SUCCESS', 'T9', NOW()), (10, 2, 59000, 'ATM', 'SUCCESS', 'T10', NOW()),
(11, 1, 20000, 'MOMO', 'SUCCESS', 'T11', NOW()), (12, 1, 20000, 'MOMO', 'SUCCESS', 'T12', NOW()),
(13, 1, 20000, 'MOMO', 'SUCCESS', 'T13', NOW()), (14, 2, 59000, 'VISA', 'SUCCESS', 'T14', NOW()),
(15, 3, 599000, 'ATM', 'SUCCESS', 'T15', NOW()), (16, 1, 20000, 'MOMO', 'SUCCESS', 'T16', NOW()),
(17, 2, 59000, 'ZALO', 'SUCCESS', 'T17', NOW()), (18, 1, 20000, 'MOMO', 'SUCCESS', 'T18', NOW()),
(19, 2, 59000, 'VISA', 'SUCCESS', 'T19', NOW()), (20, 1, 20000, 'MOMO', 'SUCCESS', 'T20', NOW()),
(21, 3, 599000, 'ATM', 'SUCCESS', 'T21', NOW()), (22, 1, 20000, 'MOMO', 'SUCCESS', 'T22', NOW()),
(23, 2, 59000, 'ZALO', 'SUCCESS', 'T23', NOW()), (24, 1, 20000, 'MOMO', 'SUCCESS', 'T24', NOW()),
(25, 2, 59000, 'VISA', 'SUCCESS', 'T25', NOW()), (26, 1, 20000, 'MOMO', 'SUCCESS', 'T26', NOW()),
(27, 3, 599000, 'ATM', 'SUCCESS', 'T27', NOW()), (28, 1, 20000, 'MOMO', 'SUCCESS', 'T28', NOW()),
(29, 2, 59000, 'ZALO', 'SUCCESS', 'T29', NOW()), (30, 1, 20000, 'MOMO', 'SUCCESS', 'T30', NOW());

-- 15. PREMIUM HISTORY
INSERT INTO user_premium_history (user_id, plan_id, payment_id, start_date, end_date) 
SELECT user_id, plan_id, payment_id, paid_at, paid_at + interval '30 days' FROM payment;

