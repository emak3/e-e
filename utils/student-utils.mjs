import fs from "node:fs";
import log from "../logger.mjs";
import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

/**
 * 学生データを読み込む関数
 * @param {string} filePath - 学生データファイルのパス
 * @returns {Object|null} - 読み込まれた学生データまたはnull（エラー時）
 */
export async function loadStudentData(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            const studentData = JSON.parse(data);
            log.info('学生データを読み込みました');
            return studentData;
        } else {
            log.info('学生データファイルが存在しません。');
            return null;
        }
    } catch (error) {
        log.error('学生データの読み込みエラー:', error);
        return null;
    }
}

/**
 * 学生番号から学生情報を検索する関数
 * @param {Object} studentData - 学生データオブジェクト
 * @param {Array} numbers - 検索する学生番号の配列
 * @returns {Array} - 見つかった学生情報の配列
 */
export function findStudentsByNumbers(studentData, numbers) {
    const foundStudents = [];
    
    // 学生番号を検索（数字の前にある0を除外して比較）
    for (let numRaw of numbers) {
        // 入力された番号から先頭の0を削除
        const numInt = parseInt(numRaw, 10);
        if (isNaN(numInt)) continue;
        
        // 番号を文字列に戻し、必要に応じて0埋め
        const numStr = numInt.toString().padStart(2, '0');
        
        if (studentData[numStr]) {
            // [抹消]でない学生データのみ追加
            if (studentData[numStr][0] !== "[抹消]") {
                // 名前を姓と名に分割（スペースで区切る）
                const fullName = studentData[numStr][0];
                let firstName = fullName;
                let lastName = "";
                
                // スペースがある場合は分割
                const nameParts = fullName.split(/\s+/);
                if (nameParts.length > 1) {
                    firstName = nameParts[0];
                    lastName = nameParts.slice(1).join(" ");
                }
                
                foundStudents.push({
                    number: numStr,
                    name: fullName,
                    firstName: firstName,
                    lastName: lastName,
                    furigana: studentData[numStr][1]
                });
            }
        }
    }
    
    return foundStudents;
}

/**
 * 表示モードに応じた学生情報のフォーマットを行う関数
 * @param {Array} students - 学生情報の配列
 * @param {string} mode - 表示モード
 * @param {string} customFormat - カスタムフォーマット（モードがcustomの場合のみ使用）
 * @returns {string} フォーマットされた学生情報のテキスト
 */
export function formatStudentInfo(students, mode, customFormat = '') {
    let result = '';
    
    switch (mode) {
        case 'number_only':
            result = '**＜出席番号のみ表示＞**\n';
            students.forEach(student => {
                result += `${parseInt(student.number, 10)}番\n`;
            });
            break;
        
        case 'name_only':
            result = '**＜氏名のみ表示＞**\n';
            students.forEach(student => {
                result += `${student.name}\n`;
            });
            break;
        
        case 'furigana_only':
            result = '**＜フリガナのみ表示＞**\n';
            students.forEach(student => {
                result += `${student.furigana}\n`;
            });
            break;
        
        case 'number_name':
            result = '**＜出席番号・氏名＞**\n';
            students.forEach(student => {
                result += `${parseInt(student.number, 10)}番 ${student.name}\n`;
            });
            break;
        
        case 'name_furigana':
            result = '**＜氏名・フリガナ＞**\n';
            students.forEach(student => {
                result += `${student.name} (${student.furigana})\n`;
            });
            break;
            
        case 'number_furigana':
            result = '**＜出席番号・フリガナ＞**\n';
            students.forEach(student => {
                result += `${parseInt(student.number, 10)}番 ${student.furigana}\n`;
            });
            break;
            
        case 'first_last_name':
            result = '**＜姓・名＞**\n';
            students.forEach(student => {
                if (student.lastName) {
                    result += `${student.firstName} ${student.lastName}\n`;
                } else {
                    result += `${student.firstName}\n`;
                }
            });
            break;
            
        case 'all_info':
            result = '**＜全情報＞**\n';
            students.forEach(student => {
                if (student.lastName) {
                    result += `${parseInt(student.number, 10)}番 ${student.firstName} ${student.lastName} (${student.furigana})\n`;
                } else {
                    result += `${parseInt(student.number, 10)}番 ${student.firstName} (${student.furigana})\n`;
                }
            });
            break;
        
        case 'custom':
            result = '**＜カスタム表示＞**\n';
            students.forEach(student => {
                // プレースホルダーの置換
                let line = customFormat
                    .replace(/\${number}/g, parseInt(student.number, 10))
                    .replace(/\${name}/g, student.name)
                    .replace(/\${firstName}/g, student.firstName)
                    .replace(/\${lastName}/g, student.lastName || '')
                    .replace(/\${furigana}/g, student.furigana);
                
                result += `${line}\n`;
            });
            break;
        
        case 'default':
        default:
            result = '**＜出席番号・氏名・フリガナ＞**\n';
            students.forEach(student => {
                result += `${parseInt(student.number, 10)}番 ${student.name} (${student.furigana})\n`;
            });
            break;
    }
    
    // 一致した学生数を表示
    result += `\n${students.length}名の学生が見つかりました`;
    
    return result;
}

/**
 * 表示切り替え用のセレクトメニューを作成する関数
 * @returns {ActionRowBuilder} セレクトメニューを含むアクションロウ
 */
export function createSelectMenu() {
    // セレクトメニューの作成
    const menu = new StringSelectMenuBuilder()
        .setCustomId('student-display-mode')
        .setPlaceholder('表示形式を選択してください')
        .addOptions(
            // デフォルト表示（番号・氏名・フリガナ）
            new StringSelectMenuOptionBuilder()
                .setLabel('番号・氏名・フリガナ')
                .setDescription('出席番号、氏名、フリガナを表示')
                .setValue('default'),
            
            // 番号のみ
            new StringSelectMenuOptionBuilder()
                .setLabel('番号のみ')
                .setDescription('出席番号のみ表示')
                .setValue('number_only'),
            
            // 氏名のみ
            new StringSelectMenuOptionBuilder()
                .setLabel('氏名のみ')
                .setDescription('氏名のみ表示')
                .setValue('name_only'),
            
            // フリガナのみ
            new StringSelectMenuOptionBuilder()
                .setLabel('フリガナのみ')
                .setDescription('フリガナのみ表示')
                .setValue('furigana_only'),
            
            // 番号・氏名
            new StringSelectMenuOptionBuilder()
                .setLabel('番号・氏名')
                .setDescription('出席番号と氏名を表示')
                .setValue('number_name'),
            
            // 氏名・フリガナ
            new StringSelectMenuOptionBuilder()
                .setLabel('氏名・フリガナ')
                .setDescription('氏名とフリガナを表示')
                .setValue('name_furigana'),
                
            // 番号・フリガナ
            new StringSelectMenuOptionBuilder()
                .setLabel('番号・フリガナ')
                .setDescription('出席番号とフリガナを表示')
                .setValue('number_furigana'),
                
            // 姓・名
            new StringSelectMenuOptionBuilder()
                .setLabel('姓・名')
                .setDescription('姓と名を分けて表示')
                .setValue('first_last_name'),
                
            // 全情報
            new StringSelectMenuOptionBuilder()
                .setLabel('全情報')
                .setDescription('姓、名、フリガナ、出席番号をすべて表示')
                .setValue('all_info'),
                
            // カスタム
            new StringSelectMenuOptionBuilder()
                .setLabel('カスタマイズ')
                .setDescription('表示形式をカスタマイズ')
                .setValue('custom')
        );
    
    return new ActionRowBuilder().addComponents(menu);
}