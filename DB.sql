--/////////////////////////////////////////////
-- 1. LOG & SYSTEM
--DROP TABLE IF EXISTS message_queue_log CASCADE;
DROP TABLE IF EXISTS login_history CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- 2. AI & RECOMMENDATION
DROP TABLE IF EXISTS recommendation_log CASCADE;
DROP TABLE IF EXISTS user_preference CASCADE;

-- 3. MEAL SETS
DROP TABLE IF EXISTS meal_set_recipe CASCADE;
DROP TABLE IF EXISTS meal_set CASCADE;

-- 4. SOCIAL & INTERACTIONS
DROP TABLE IF EXISTS rating CASCADE;
DROP TABLE IF EXISTS favorite_recipe CASCADE;

-- 5. RECIPE & INGREDIENTS
DROP TABLE IF EXISTS recipe_ingredient CASCADE;
DROP TABLE IF EXISTS recipe CASCADE;
DROP TABLE IF EXISTS ingredient CASCADE;

-- 6. PREMIUM & PAYMENT
DROP TABLE IF EXISTS user_premium_history CASCADE;
DROP TABLE IF EXISTS payment CASCADE;
DROP TABLE IF EXISTS premium_plan CASCADE;

--////////////////////////////////////////////


-- USER

create table app_user( 
	user_id serial primary key,
	email varchar (100) not null, -- dang nhap bang email
	password_hash varchar (255) not null, -- cai nay se hash ben c#
	full_name varchar (100), -- dang ky can ho ten
	avatar_url varchar (255),
	status varchar (40) check (status in ('ACTIVE', 'BLOCKED', 'DELETED')) default 'ACTIVE',
	
	--chieu cao, can nang
--	height float,
--	weight float, 
--	bmi numeric (4,2) 
--	GENERATED ALWAYS AS (
--    CASE 
--        WHEN height > 0 THEN weight / ((height/100.0) * (height/100.0)) 
--        ELSE 0 
--    END
--) stored,
	create_at timestamp default current_timestamp,
	deleted_at timestamp default null
	
);
create table role (
	role_id serial primary key, 
	role_name varchar (50) unique not null
);

create table user_role (
	user_id int,
	role_id int, 
	primary key (user_id, role_id),
	foreign key (user_id) references app_user(user_id),
	foreign key (role_id) references role (role_id)
);

--TOKEN
create table refresh_token (
	token_id serial primary key,
	user_id int not null,
	token text not null,
	expired_at timestamp not null, --thoi gian het han
	device_info varchar (100),
	ip_address varchar (50),
	is_revoked boolean default false, --duoc thu hoi
	create_at timestamp default current_timestamp,
	foreign key (user_id) references app_user (user_id)
);

--PREMIUM & PAYMENT
--cac goi premium
create table premium_plan (
	plan_id serial primary key,
	plan_name varchar (50) not null,
	price numeric (10, 2) not null, 
	duration_days int not null, --ngay het han
	description text,
	is_active boolean default true
);

create table payment ( 
	payment_id serial primary key,
	user_id int, 
	plan_id int,
	amount numeric (10, 2), 
	payment_method varchar (50), --phuong thuc thanh toan
	internal_reference VARCHAR(100) UNIQUE NOT NULL, -- Mã gửi đi cổng thanh toán (VD: PAY_USER1_1690000)
	transaction_code varchar (100), -- ma giao dich tu ben thu 3 trả về để đối soát
	status VARCHAR(20) CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED')) DEFAULT 'PENDING',
	paid_at timestamp,     --luc user thuc su thanh toan xong
	create_at timestamp default current_timestamp,
	foreign key (user_id) references app_user (user_id),
	foreign key (plan_id) references premium_plan (plan_id)
);

create table user_premium_history (
	history_id serial primary key, 
	user_id int,
	plan_id int, 
	payment_id int NOT NULL UNIQUE,
	start_date timestamp,
	end_date timestamp,
	foreign key (user_id) references app_user(user_id),
	foreign key (plan_id) references premium_plan(plan_id),
	foreign key (payment_id) references payment(payment_id)
);

--INGREDIENT & RECIPE
create table ingredient (
	ingredient_id serial primary key,
	name varchar (100) not null,
	type varchar (20) check (type in ('MEAT', 'VEGETABLE', 'SPICE', 'FRUIT', 'OTHER', 'STARCH')), -- CAI NAY DE LOC 
	image_url varchar (500),
	is_common BOOLEAN DEFAULT FALSE, -- cai nay de hien thi nguyen lieu pho bien
	status varchar (20) check (status in ('ACTIVE', 'HIDDEN')) default 'ACTIVE', -- xoa mem nguyen lieu
	keywords TEXT, -- luu cac tu dong nghia de search
	create_at timestamp default current_timestamp
);

CREATE TABLE recipe (
    recipe_id SERIAL PRIMARY KEY,
    author_id INT REFERENCES app_user(user_id),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    ingredients_json JSONB NOT NULL, -- Chi tiết nguyên liệu & định lượng|| cai nay tac dung same khoa ngoai nma minh se code de tham chieu no den bang ben tren
    --chinh vi the neu co nhieu tk cung co id = 1 thi khi code se co 3 th
    --1. code tham chieu = sql, luc nay no se lay tat ca tk co id vua tim
    --2. code logic o BE --> tuy vao cai sd se ra dc 1 hoac tat ca
    ----> can 
    steps_json JSONB NOT NULL,       -- Các bước thực hiện
    dish_type VARCHAR(100),
    image_url VARCHAR(500),
    total_calories NUMERIC(6,2),
    cooking_time INT,
    difficulty VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


--//:tim kiem nhan goi y sieu nhanh
CREATE TABLE recipe_ingredient_map (
    recipe_id INT REFERENCES recipe(recipe_id) ON DELETE CASCADE, -- cai nay no chinh la
    ingredient_id INT REFERENCES ingredient(ingredient_id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, ingredient_id)
);


--Rating
CREATE TABLE rating (
    rating_id SERIAL PRIMARY KEY,
    user_id INT,
    recipe_id INT,
    score INT CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(recipe_id)
);

--MEAL
create table meal_set (
	meal_set_id serial primary key,
	name varchar (100),
	target_calories numeric (6,2),
	meal_type varchar (50), 
	user_id int, -- nguoi tao ra cai bua com nay 
	total_calories numeric (10, 2),
	image_url varchar (500),
	goal_type VARCHAR(20) CHECK (goal_type IN ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT')),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES app_user(user_id)
);

create table meal_set_recipe (
	meal_set_id int,
	recipe_id int,
	primary key (meal_set_id, recipe_id),
	foreign key (meal_set_id) references meal_set (meal_set_id),
	foreign key (recipe_id) references recipe (recipe_id)
);

-- FAVORITE USER
CREATE TABLE favorite_recipe (
    user_id INT NOT NULL,
    recipe_id INT NOT NULL,
    primary key (user_id, recipe_id),
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(recipe_id)
);

CREATE TABLE favorite_meal_set (
    user_id INT,        
    meal_set_id INT,    
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, meal_set_id), 
    FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    FOREIGN KEY (meal_set_id) REFERENCES meal_set(meal_set_id)
);

--AI
create table user_preference (
	user_id int primary key,
	diet_type varchar (50),
	allergy text,
	dislike_ingredient text,
	--cai nay nhu kieu la de luu lai lich su cua cai thanh o bua an
	current_goal VARCHAR(20) CHECK (current_goal IN ('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_WEIGHT')),
	target_calories numeric (6,2),
	foreign key (user_id) references app_user(user_id)
);


create table recommendation_log ( --cai bang nay no chinh la bang goi y
	log_id serial primary key,
	user_id int,
	input_data JSON,
	result JSON, 
	created_at timestamp default current_timestamp,
	input_type VARCHAR(20) CHECK (input_type IN ('MANUAL_SELECT', 'TEXT', 'VOICE', 'IMAGE')),
	foreign key (user_id) references app_user(user_id)
);

-- MESSAGE QUEUE (EVENT LOG)--CHUWA CHAY
CREATE TABLE message_queue_log (
    message_id SERIAL PRIMARY KEY,
    event_type VARCHAR(50),
    payload JSONB,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


select * from ingredient;
