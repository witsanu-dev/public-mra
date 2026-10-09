/*
 Navicat Premium Dump SQL

 Source Server         : 10.250.101.11 - website
 Source Server Type    : MySQL
 Source Server Version : 80045 (8.0.45)
 Source Host           : 10.250.101.11:3306
 Source Schema         : db_mra

 Target Server Type    : MySQL
 Target Server Version : 80045 (8.0.45)
 File Encoding         : 65001

 Date: 09/10/2026 10:47:44
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for mra_audit_trail
-- ----------------------------
DROP TABLE IF EXISTS `mra_audit_trail`;
CREATE TABLE `mra_audit_trail`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `category` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('success','failed','denied') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `severity` enum('info','warning','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `actor_loginname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `actor_fullname` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `actor_role` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `target_type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `target_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `summary` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `user_agent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `request_method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `request_path` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_audit_trail_time`(`event_time` ASC) USING BTREE,
  INDEX `idx_audit_trail_actor`(`actor_loginname` ASC, `event_time` ASC) USING BTREE,
  INDEX `idx_audit_trail_cat_action`(`category` ASC, `action` ASC, `event_time` ASC) USING BTREE,
  INDEX `idx_audit_trail_target`(`target_type` ASC, `target_id` ASC) USING BTREE,
  INDEX `idx_audit_trail_status`(`status` ASC, `severity` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 413 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_ipd_audit
-- ----------------------------
DROP TABLE IF EXISTS `mra_ipd_audit`;
CREATE TABLE `mra_ipd_audit`  (
  `audit_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `an` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `hcode` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '11078',
  `hname` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'โรงพยาบาลกมลาไสย',
  `case_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `is_psychiatric` tinyint(1) NOT NULL DEFAULT 0,
  `ward_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `ward_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `admit_date` datetime NULL DEFAULT NULL,
  `discharge_date` datetime NULL DEFAULT NULL,
  `length_of_stay` int NULL DEFAULT 0,
  `discharge_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `discharge_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `diagnosis` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `sum_score` int NOT NULL DEFAULT 0,
  `full_score` int NOT NULL DEFAULT 0,
  `percentage` decimal(5, 2) NOT NULL DEFAULT 0.00,
  `is_passed` tinyint(1) NOT NULL DEFAULT 0,
  `overall_finding` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'no_issue',
  `certain_issue_remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `auditor_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `audit_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`) USING BTREE,
  INDEX `idx_an`(`an` ASC) USING BTREE,
  INDEX `idx_hn`(`hn` ASC) USING BTREE,
  INDEX `idx_audit_date`(`audit_date` ASC) USING BTREE,
  INDEX `idx_ipd_case_type`(`case_type` ASC, `is_psychiatric` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_ipd_audit_detail
-- ----------------------------
DROP TABLE IF EXISTS `mra_ipd_audit_detail`;
CREATE TABLE `mra_ipd_audit_detail`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `audit_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_no` int NOT NULL,
  `content_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `na_selected` tinyint(1) NULL DEFAULT 0,
  `missing_selected` tinyint(1) NULL DEFAULT 0,
  `no_selected` tinyint(1) NOT NULL DEFAULT 0,
  `scores_json` json NOT NULL,
  `add_score` int NULL DEFAULT 0,
  `deduct_score` int NULL DEFAULT 0,
  `calculated_full` int NULL DEFAULT 0,
  `calculated_sum` int NULL DEFAULT 0,
  `remark_text` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_audit_id`(`audit_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 829 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_ipd_sampling_batch
-- ----------------------------
DROP TABLE IF EXISTS `mra_ipd_sampling_batch`;
CREATE TABLE `mra_ipd_sampling_batch`  (
  `batch_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `sampling_date` datetime NOT NULL,
  `case_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `date_from` date NOT NULL,
  `date_to` date NOT NULL,
  `sample_size` int NOT NULL,
  `total_available` int NOT NULL DEFAULT 0,
  `ward_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `ward_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `status` enum('active','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'active',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'Auditor',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`) USING BTREE,
  INDEX `idx_sampling_date`(`sampling_date` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_ipd_sampling_item
-- ----------------------------
DROP TABLE IF EXISTS `mra_ipd_sampling_item`;
CREATE TABLE `mra_ipd_sampling_item`  (
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `an` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cid` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `patient_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sex` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `age_y` int NULL DEFAULT 0,
  `regdate` date NOT NULL,
  `regtime` time NULL DEFAULT NULL,
  `dchdate` date NOT NULL,
  `dchtime` time NULL DEFAULT NULL,
  `ward_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `ward_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `pdx` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `diagnosis_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `pttype_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `dchstts` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `dchtype` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `length_of_stay` int NULL DEFAULT 1,
  `doctor_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `audit_status` enum('pending','audited') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'pending',
  `audit_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `audited_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`item_id`) USING BTREE,
  INDEX `idx_ipd_batch`(`batch_id` ASC) USING BTREE,
  INDEX `idx_ipd_an`(`an` ASC) USING BTREE,
  INDEX `idx_ipd_hn`(`hn` ASC) USING BTREE,
  INDEX `idx_ipd_status`(`audit_status` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_opd_audit
-- ----------------------------
DROP TABLE IF EXISTS `mra_opd_audit`;
CREATE TABLE `mra_opd_audit`  (
  `audit_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `vn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `pid` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `patient_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `hcode` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '11078',
  `hname` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'โรงพยาบาลกมลาไสย',
  `case_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `is_psychiatric` tinyint(1) NOT NULL DEFAULT 0,
  `diagnosis` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `visit_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `chronic_period_from` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `chronic_period_to` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `first_visit_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `sum_score` int NOT NULL DEFAULT 0,
  `full_score` int NOT NULL DEFAULT 0,
  `percentage` decimal(5, 2) NOT NULL DEFAULT 0.00,
  `is_passed` tinyint(1) NOT NULL DEFAULT 0,
  `overall_finding` enum('inadequate','no_issue','certain_issues') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'no_issue',
  `certain_issue_remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `auditor_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `audit_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`) USING BTREE,
  INDEX `idx_vn`(`vn` ASC) USING BTREE,
  INDEX `idx_hn`(`hn` ASC) USING BTREE,
  INDEX `idx_audit_date`(`audit_date` ASC) USING BTREE,
  INDEX `idx_opd_case_type`(`case_type` ASC, `is_psychiatric` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_opd_audit_detail
-- ----------------------------
DROP TABLE IF EXISTS `mra_opd_audit_detail`;
CREATE TABLE `mra_opd_audit_detail`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `audit_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_no` int NOT NULL,
  `content_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `na_selected` tinyint(1) NULL DEFAULT 0,
  `missing_selected` tinyint(1) NULL DEFAULT 0,
  `scores_json` json NOT NULL,
  `add_score` int NULL DEFAULT 0,
  `deduct_score` int NULL DEFAULT 0,
  `calculated_full` int NULL DEFAULT 0,
  `calculated_sum` int NULL DEFAULT 0,
  `remark_text` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_audit_id`(`audit_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 871 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_sampling_batch
-- ----------------------------
DROP TABLE IF EXISTS `mra_sampling_batch`;
CREATE TABLE `mra_sampling_batch`  (
  `batch_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `sampling_date` datetime NOT NULL,
  `case_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `date_from` date NOT NULL,
  `date_to` date NOT NULL,
  `sample_size` int NOT NULL,
  `total_available` int NOT NULL DEFAULT 0,
  `department_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `status` enum('active','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'Auditor',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_sampling_item
-- ----------------------------
DROP TABLE IF EXISTS `mra_sampling_item`;
CREATE TABLE `mra_sampling_item`  (
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `vn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cid` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `patient_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sex` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `age_y` int NULL DEFAULT 0,
  `vstdate` date NOT NULL,
  `vsttime` time NULL DEFAULT NULL,
  `department` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `pdx` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `diagnosis_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `pttype_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `doctor_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `chief_complaint` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `audit_status` enum('pending','audited') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'pending',
  `audit_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `audited_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`item_id`) USING BTREE,
  INDEX `idx_batch`(`batch_id` ASC) USING BTREE,
  INDEX `idx_vn`(`vn` ASC) USING BTREE,
  INDEX `idx_hn`(`hn` ASC) USING BTREE,
  INDEX `idx_status`(`audit_status` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for mra_user_2fa
-- ----------------------------
DROP TABLE IF EXISTS `mra_user_2fa`;
CREATE TABLE `mra_user_2fa`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `loginname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_fullname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `secret_encrypted` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `backup_codes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `last_used_step` bigint NULL DEFAULT NULL,
  `failed_attempts` int NOT NULL DEFAULT 0,
  `locked_until` datetime NULL DEFAULT NULL,
  `enrolled_at` datetime NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `loginname`(`loginname` ASC) USING BTREE,
  INDEX `idx_loginname`(`loginname` ASC) USING BTREE,
  INDEX `idx_enabled`(`is_enabled` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 15 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for sys_db_connections
-- ----------------------------
DROP TABLE IF EXISTS `sys_db_connections`;
CREATE TABLE `sys_db_connections`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `connection_key` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `db_type` enum('his','mra') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `host` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int NOT NULL DEFAULT 3306,
  `database_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_encrypted` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_tested_at` datetime NULL DEFAULT NULL,
  `last_latency_ms` int NULL DEFAULT NULL,
  `last_status` enum('online','offline','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'unknown',
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `connection_key`(`connection_key` ASC) USING BTREE,
  INDEX `idx_db_type_active`(`db_type` ASC, `is_active` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 27 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for sys_security_keys
-- ----------------------------
DROP TABLE IF EXISTS `sys_security_keys`;
CREATE TABLE `sys_security_keys`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `key_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Key identifier name (e.g. ADMIN_SETUP_KEY)',
  `key_value_encrypted` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AES-256 encrypted security key value',
  `key_hint` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Masked hint to help Admin recall if forgotten',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Key usage description',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Active, 0=Revoked',
  `last_used_at` datetime NULL DEFAULT NULL COMMENT 'Last time key was successfully used',
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `idx_key_name`(`key_name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `full_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `doctor_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `position_id` int NULL DEFAULT NULL,
  `position_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `salt` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `role` enum('Administrator','Auditor','Officer') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Auditor',
  `role_description` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `auth_source` enum('his_synced','local') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'local',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_sync_at` datetime NULL DEFAULT NULL,
  `last_login_at` datetime NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `username`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2438 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- View structure for view_mra_category_performance
-- ----------------------------
DROP VIEW IF EXISTS `view_mra_category_performance`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_mra_category_performance` AS select 'OPD' AS `service_type`,`a`.`case_type` AS `case_type`,`a`.`is_psychiatric` AS `is_psychiatric`,date_format(`a`.`audit_date`,'%Y-%m') AS `audit_month`,`d`.`content_no` AS `content_no`,`d`.`content_name` AS `content_name`,count(0) AS `total_evaluations`,sum(`d`.`na_selected`) AS `na_count`,sum(`d`.`missing_selected`) AS `missing_count`,sum(`d`.`calculated_full`) AS `total_full_score`,sum(`d`.`calculated_sum`) AS `total_sum_score`,round((case when (sum(`d`.`calculated_full`) > 0) then ((sum(`d`.`calculated_sum`) * 100.0) / sum(`d`.`calculated_full`)) else 0.00 end),2) AS `compliance_rate` from (`mra_opd_audit_detail` `d` join `mra_opd_audit` `a` on((`a`.`audit_id` = `d`.`audit_id`))) group by `a`.`case_type`,`a`.`is_psychiatric`,date_format(`a`.`audit_date`,'%Y-%m'),`d`.`content_no`,`d`.`content_name` union all select 'IPD' AS `service_type`,`a`.`case_type` AS `case_type`,`a`.`is_psychiatric` AS `is_psychiatric`,date_format(`a`.`audit_date`,'%Y-%m') AS `audit_month`,`d`.`content_no` AS `content_no`,`d`.`content_name` AS `content_name`,count(0) AS `total_evaluations`,sum(`d`.`na_selected`) AS `na_count`,sum(`d`.`missing_selected`) AS `missing_count`,sum(`d`.`calculated_full`) AS `total_full_score`,sum(`d`.`calculated_sum`) AS `total_sum_score`,round((case when (sum(`d`.`calculated_full`) > 0) then ((sum(`d`.`calculated_sum`) * 100.0) / sum(`d`.`calculated_full`)) else 0.00 end),2) AS `compliance_rate` from (`mra_ipd_audit_detail` `d` join `mra_ipd_audit` `a` on((`a`.`audit_id` = `d`.`audit_id`))) group by `a`.`case_type`,`a`.`is_psychiatric`,date_format(`a`.`audit_date`,'%Y-%m'),`d`.`content_no`,`d`.`content_name`;

-- ----------------------------
-- View structure for view_mra_executive_summary
-- ----------------------------
DROP VIEW IF EXISTS `view_mra_executive_summary`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `view_mra_executive_summary` AS select 'OPD' AS `service_type`,`mra_opd_audit`.`case_type` AS `case_type`,`mra_opd_audit`.`is_psychiatric` AS `is_psychiatric`,date_format(`mra_opd_audit`.`audit_date`,'%Y-%m') AS `audit_month`,count(0) AS `total_audited`,round(avg(`mra_opd_audit`.`percentage`),2) AS `avg_percentage`,sum((case when (`mra_opd_audit`.`is_passed` = 1) then 1 else 0 end)) AS `passed_count`,sum((case when (`mra_opd_audit`.`is_passed` = 0) then 1 else 0 end)) AS `failed_count`,round(((sum((case when (`mra_opd_audit`.`is_passed` = 1) then 1 else 0 end)) * 100.0) / count(0)),2) AS `pass_rate`,sum((case when (`mra_opd_audit`.`overall_finding` = 'inadequate') then 1 else 0 end)) AS `inadequate_count`,sum((case when (`mra_opd_audit`.`overall_finding` = 'certain_issues') then 1 else 0 end)) AS `certain_issues_count`,sum((case when (`mra_opd_audit`.`overall_finding` = 'no_issue') then 1 else 0 end)) AS `no_issue_count`,sum((case when (`mra_opd_audit`.`overall_finding` = 'order_not_standard') then 1 else 0 end)) AS `order_not_standard_count`,sum((case when (`mra_opd_audit`.`overall_finding` = 'missing_patient_identifiers') then 1 else 0 end)) AS `missing_identifiers_count` from `mra_opd_audit` group by `mra_opd_audit`.`case_type`,`mra_opd_audit`.`is_psychiatric`,date_format(`mra_opd_audit`.`audit_date`,'%Y-%m') union all select 'IPD' AS `service_type`,`mra_ipd_audit`.`case_type` AS `case_type`,`mra_ipd_audit`.`is_psychiatric` AS `is_psychiatric`,date_format(`mra_ipd_audit`.`audit_date`,'%Y-%m') AS `audit_month`,count(0) AS `total_audited`,round(avg(`mra_ipd_audit`.`percentage`),2) AS `avg_percentage`,sum((case when (`mra_ipd_audit`.`is_passed` = 1) then 1 else 0 end)) AS `passed_count`,sum((case when (`mra_ipd_audit`.`is_passed` = 0) then 1 else 0 end)) AS `failed_count`,round(((sum((case when (`mra_ipd_audit`.`is_passed` = 1) then 1 else 0 end)) * 100.0) / count(0)),2) AS `pass_rate`,sum((case when (`mra_ipd_audit`.`overall_finding` = 'inadequate') then 1 else 0 end)) AS `inadequate_count`,sum((case when (`mra_ipd_audit`.`overall_finding` = 'certain_issues') then 1 else 0 end)) AS `certain_issues_count`,sum((case when (`mra_ipd_audit`.`overall_finding` = 'no_issue') then 1 else 0 end)) AS `no_issue_count`,sum((case when (`mra_ipd_audit`.`overall_finding` = 'order_not_standard') then 1 else 0 end)) AS `order_not_standard_count`,sum((case when (`mra_ipd_audit`.`overall_finding` = 'missing_patient_identifiers') then 1 else 0 end)) AS `missing_identifiers_count` from `mra_ipd_audit` group by `mra_ipd_audit`.`case_type`,`mra_ipd_audit`.`is_psychiatric`,date_format(`mra_ipd_audit`.`audit_date`,'%Y-%m');

SET FOREIGN_KEY_CHECKS = 1;
