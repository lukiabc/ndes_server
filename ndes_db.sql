/*
 Navicat Premium Data Transfer

 Source Server         : lxy
 Source Server Type    : MySQL
 Source Server Version : 80026
 Source Host           : localhost:3306
 Source Schema         : ndes_db

 Target Server Type    : MySQL
 Target Server Version : 80026
 File Encoding         : 65001

 Date: 31/10/2025 14:25:22
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for articles
-- ----------------------------
DROP TABLE IF EXISTS `articles`;
CREATE TABLE `articles`  (
  `article_id` int NOT NULL AUTO_INCREMENT COMMENT '文章ID，主键，自增',
  `category_id` int NULL DEFAULT NULL COMMENT '分类ID，外键',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文章标题',
  `source` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '来源',
  `editor` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '责任编辑',
  `publish_date` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布日期，默认当前时间',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '文章内容',
  `status` enum('草稿','待审','已发布') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '草稿' COMMENT '稿件状态',
  `scheduled_publish_date` datetime NULL DEFAULT NULL COMMENT '计划发布时间',
  PRIMARY KEY (`article_id`) USING BTREE,
  INDEX `category_id`(`category_id` ASC) USING BTREE,
  FULLTEXT INDEX `ft_title_content`(`title`, `content`),
  CONSTRAINT `articles_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '存储文章的详细信息' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of articles
-- ----------------------------
INSERT INTO `articles` VALUES (3, 219, '测试文章啦啦', '测试来源', '测试编辑', '2025-10-22 14:25:49', '这是测试文章的内容', '待审', NULL);
INSERT INTO `articles` VALUES (4, 219, '测试文章啦', '测试来源', '测试编辑', '2025-10-23 08:18:39', '这是测试文章的内容', '待审', NULL);
INSERT INTO `articles` VALUES (5, 220, '测试文章拉拉', '测试来源', '测试编辑', '2025-10-23 08:19:01', '这是测试文章的内容', '已发布', NULL);
INSERT INTO `articles` VALUES (6, 222, '文章', '六', '六六六', '2025-10-30 07:47:41', '内容', '待审', NULL);
INSERT INTO `articles` VALUES (9, 222, '测试文章', '测试来源', '测试编辑', '2025-10-30 11:25:42', '<p>第一段：正常文字</p>\r\n<p><img src=\"http://localhost:3000/uploads/zhsh1761823542804.png\" alt=\"\" style=\"width: 50%;\"></p>\r\n<p><strong><span style=\"color: red;\">第二段：加粗红色文字</span></strong></p>\r\n<p><img src=\"http://localhost:3000/uploads/xuer1761823920057.png\" alt=\"\" style=\"width: 100%;\"></p>', '草稿', NULL);

-- ----------------------------
-- Table structure for categories
-- ----------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories`  (
  `category_id` int NOT NULL AUTO_INCREMENT COMMENT '分类ID，主键，自增',
  `parent_id` int NULL DEFAULT NULL COMMENT '父分类ID，null表示顶级分类',
  `category_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分类名称',
  `sort_order` int NULL DEFAULT 0 COMMENT '同级排序，升序',
  PRIMARY KEY (`category_id`) USING BTREE,
  INDEX `parent_id`(`parent_id` ASC) USING BTREE,
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`category_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 306 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '存储网站的分类信息' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of categories
-- ----------------------------
INSERT INTO `categories` VALUES (2, NULL, '权威发布', 0);
INSERT INTO `categories` VALUES (3, NULL, '新闻发言人', 0);
INSERT INTO `categories` VALUES (4, NULL, '军事外交', 0);
INSERT INTO `categories` VALUES (5, NULL, '武装力量', 0);
INSERT INTO `categories` VALUES (6, NULL, '军事行动', 0);
INSERT INTO `categories` VALUES (7, NULL, '国防服务', 0);
INSERT INTO `categories` VALUES (8, NULL, '法规文献', 0);
INSERT INTO `categories` VALUES (9, NULL, '国防动员', 0);
INSERT INTO `categories` VALUES (10, NULL, '国防教育', 0);
INSERT INTO `categories` VALUES (219, 2, '军委办公厅', 0);
INSERT INTO `categories` VALUES (220, 2, '军委联合参谋部', 0);
INSERT INTO `categories` VALUES (221, 2, '军委政治工作部', 0);
INSERT INTO `categories` VALUES (222, 2, '军委后勤保障部', 0);
INSERT INTO `categories` VALUES (223, 2, '军委装备发展部', 0);
INSERT INTO `categories` VALUES (224, 2, '军委训练管理部', 0);
INSERT INTO `categories` VALUES (225, 2, '军委国防动员部', 0);
INSERT INTO `categories` VALUES (226, 2, '军委纪律检查委员会', 0);
INSERT INTO `categories` VALUES (227, 2, '军委政法委员会', 0);
INSERT INTO `categories` VALUES (228, 2, '军委科学技术委员会', 0);
INSERT INTO `categories` VALUES (229, 2, '军委战略规划办公室', 0);
INSERT INTO `categories` VALUES (230, 2, '军委改革和编制办公室', 0);
INSERT INTO `categories` VALUES (231, 2, '军委国际军事合作办公室', 0);
INSERT INTO `categories` VALUES (232, 2, '军委审计署', 0);
INSERT INTO `categories` VALUES (233, 2, '军委机关事务管理总局', 0);
INSERT INTO `categories` VALUES (234, 3, '发言人简介', 0);
INSERT INTO `categories` VALUES (235, 3, '发言人谈话和答记者问', 0);
INSERT INTO `categories` VALUES (236, 3, '例行新闻发布', 0);
INSERT INTO `categories` VALUES (237, 3, '例行记者会', 0);
INSERT INTO `categories` VALUES (238, 3, '专题记者会', 0);
INSERT INTO `categories` VALUES (239, 3, '例会专题', 0);
INSERT INTO `categories` VALUES (240, 4, '来访', 0);
INSERT INTO `categories` VALUES (241, 4, '出访', 0);
INSERT INTO `categories` VALUES (242, 4, '交流', 0);
INSERT INTO `categories` VALUES (243, 4, '留学', 0);
INSERT INTO `categories` VALUES (244, 5, '东部战区', 0);
INSERT INTO `categories` VALUES (245, 5, '南部战区', 0);
INSERT INTO `categories` VALUES (246, 5, '西部战区', 0);
INSERT INTO `categories` VALUES (247, 5, '北部战区', 0);
INSERT INTO `categories` VALUES (248, 5, '中部战区', 0);
INSERT INTO `categories` VALUES (249, 5, '陆军', 0);
INSERT INTO `categories` VALUES (250, 5, '海军', 0);
INSERT INTO `categories` VALUES (251, 5, '空军', 0);
INSERT INTO `categories` VALUES (252, 5, '火箭军', 0);
INSERT INTO `categories` VALUES (253, 5, '武警', 0);
INSERT INTO `categories` VALUES (254, 5, '民兵预备役', 0);
INSERT INTO `categories` VALUES (255, 6, '联演', 0);
INSERT INTO `categories` VALUES (256, 6, '维和', 0);
INSERT INTO `categories` VALUES (257, 6, '反恐', 0);
INSERT INTO `categories` VALUES (258, 6, '救援', 0);
INSERT INTO `categories` VALUES (259, 6, '护航', 0);
INSERT INTO `categories` VALUES (260, 7, '入伍', 0);
INSERT INTO `categories` VALUES (261, 7, '招生', 0);
INSERT INTO `categories` VALUES (262, 7, '招飞', 0);
INSERT INTO `categories` VALUES (263, 7, '招聘', 0);
INSERT INTO `categories` VALUES (264, 7, '军属', 0);
INSERT INTO `categories` VALUES (265, 7, '卫生', 0);
INSERT INTO `categories` VALUES (266, 8, '法律法规', 0);
INSERT INTO `categories` VALUES (267, 8, '白皮书', 0);
INSERT INTO `categories` VALUES (268, 8, '文件', 0);
INSERT INTO `categories` VALUES (269, 8, '司法解释', 0);
INSERT INTO `categories` VALUES (270, 8, '出版物', 0);
INSERT INTO `categories` VALUES (271, 9, '武装动员', 0);
INSERT INTO `categories` VALUES (272, 9, '政治动员', 0);
INSERT INTO `categories` VALUES (273, 9, '经济动员', 0);
INSERT INTO `categories` VALUES (274, 9, '交通动员', 0);
INSERT INTO `categories` VALUES (275, 9, '人民防空', 0);
INSERT INTO `categories` VALUES (276, 10, '重要活动', 0);
INSERT INTO `categories` VALUES (277, 10, '先进典型', 0);
INSERT INTO `categories` VALUES (278, 10, '军事院校', 0);
INSERT INTO `categories` VALUES (279, 10, '军史', 0);
INSERT INTO `categories` VALUES (284, NULL, '大大大分类', 0);
INSERT INTO `categories` VALUES (288, 284, '新分类77', 0);
INSERT INTO `categories` VALUES (290, 284, '新分类2', 0);
INSERT INTO `categories` VALUES (291, 284, '新分类', 0);
INSERT INTO `categories` VALUES (304, NULL, 'aaa', 0);
INSERT INTO `categories` VALUES (305, 304, '444', 0);

-- ----------------------------
-- Table structure for media
-- ----------------------------
DROP TABLE IF EXISTS `media`;
CREATE TABLE `media`  (
  `media_id` int NOT NULL AUTO_INCREMENT COMMENT '多媒体ID，主键，自增',
  `article_id` int NULL DEFAULT NULL COMMENT '文章ID，外键',
  `media_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '媒体类型（图片、视频等）',
  `media_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '媒体文件URL',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '媒体描述',
  PRIMARY KEY (`media_id`) USING BTREE,
  INDEX `article_id`(`article_id` ASC) USING BTREE,
  CONSTRAINT `media_ibfk_1` FOREIGN KEY (`article_id`) REFERENCES `articles` (`article_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '存储与文章相关的多媒体文件信息' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of media
-- ----------------------------
INSERT INTO `media` VALUES (4, 3, 'image/png', 'http://localhost:3000/uploads/11111761143149422.png', '1111.png');
INSERT INTO `media` VALUES (5, 4, 'image/png', 'http://localhost:3000/uploads/11111761207519862.png', '1111.png');
INSERT INTO `media` VALUES (6, 5, 'image/png', 'http://localhost:3000/uploads/11111761207541446.png', '');
INSERT INTO `media` VALUES (11, 9, 'image/png', 'http://localhost:3000/uploads/zhsh1761823542804.png', 'zhsh.png');
INSERT INTO `media` VALUES (15, 6, 'image/png', 'http://localhost:3000/uploads/xuer1761823920057.png', 'xuer.png');

-- ----------------------------
-- Table structure for reviews
-- ----------------------------
DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews`  (
  `review_id` int NOT NULL AUTO_INCREMENT COMMENT '审核记录ID',
  `article_id` int NOT NULL COMMENT '文章ID',
  `reviewer` int NOT NULL COMMENT '审核人ID（users.user_id）',
  `review_result` enum('通过','退回修改','拒绝') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '审核结果',
  `review_comments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '审核意见',
  `review_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审核时间',
  PRIMARY KEY (`review_id`) USING BTREE,
  INDEX `idx_article_id`(`article_id` ASC) USING BTREE,
  INDEX `idx_reviewer`(`reviewer` ASC) USING BTREE,
  CONSTRAINT `fk_review_article` FOREIGN KEY (`article_id`) REFERENCES `articles` (`article_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_review_user` FOREIGN KEY (`reviewer`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of reviews
-- ----------------------------

-- ----------------------------
-- Table structure for roles
-- ----------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles`  (
  `role_id` int NOT NULL AUTO_INCREMENT COMMENT '角色ID，主键，自增',
  `role_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称，如“管理员”或“发布者”',
  `permissions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色权限，存储为JSON格式的字符串',
  PRIMARY KEY (`role_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of roles
-- ----------------------------
INSERT INTO `roles` VALUES (1, '管理员', '{\"create\": true, \"read\": true, \"update\": true, \"delete\": true, \"review\": true}');
INSERT INTO `roles` VALUES (2, '发布者', '{\"create\": true, \"read\": true, \"update\": true, \"delete\": false, \"review\": false}');

-- ----------------------------
-- Table structure for sensitive_words
-- ----------------------------
DROP TABLE IF EXISTS `sensitive_words`;
CREATE TABLE `sensitive_words`  (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '敏感词ID，主键自增',
  `word` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '敏感词内容，全局唯一',
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `word`(`word` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 12 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '敏感词库' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sensitive_words
-- ----------------------------
INSERT INTO `sensitive_words` VALUES (1, '暴乱', '2025-10-23 18:19:35');
INSERT INTO `sensitive_words` VALUES (2, '色情', '2025-10-23 18:19:35');
INSERT INTO `sensitive_words` VALUES (3, '赌博', '2025-10-23 18:19:35');
INSERT INTO `sensitive_words` VALUES (4, '毒品', '2025-10-23 18:19:35');
INSERT INTO `sensitive_words` VALUES (5, '枪支', '2025-10-23 18:19:35');
INSERT INTO `sensitive_words` VALUES (10, '啦啦', '2025-10-28 10:31:10');

-- ----------------------------
-- Table structure for test
-- ----------------------------
DROP TABLE IF EXISTS `test`;
CREATE TABLE `test`  (
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `age` int NOT NULL
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of test
-- ----------------------------
INSERT INTO `test` VALUES ('夏明', 25);

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `user_id` int NOT NULL AUTO_INCREMENT COMMENT '用户ID，主键，自增',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户名，唯一',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户密码，建议使用加密存储（如bcrypt）',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '用户邮箱地址，可选',
  `role_id` int NOT NULL COMMENT '角色ID，外键，关联角色表',
  `avatar_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '用户头像图片URL，可选',
  `created_at` datetime NOT NULL COMMENT '用户创建时间',
  `updated_at` datetime NOT NULL COMMENT '用户更新时间',
  PRIMARY KEY (`user_id`) USING BTREE,
  INDEX `role_id`(`role_id` ASC) USING BTREE,
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 10024 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (10001, 'admin', '123456', '3116291152@qq.com', 1, 'http://localhost:3000/uploads/hh1761553595613.jpg', '2025-10-12 16:21:19', '2025-10-27 08:26:35');
INSERT INTO `users` VALUES (10021, 'publisher1', '12345631', '3116291152@qq.com', 2, 'http://localhost:3000/uploads/gs1761126308494.jpg', '2025-10-12 16:21:19', '2025-10-12 16:21:19');
INSERT INTO `users` VALUES (10022, 'publisher2', '12345631', '3116291152@qq.com', 2, 'http://localhost:3000/uploads/kk.jpg', '2025-10-12 16:21:19', '2025-10-12 16:21:19');
INSERT INTO `users` VALUES (10023, 'publisher3', '12345631', '3116291152@qq.com', 2, 'http://localhost:3000/uploads/gs1761126308494.jpg', '2025-10-12 16:21:19', '2025-10-12 16:21:19');

SET FOREIGN_KEY_CHECKS = 1;
