pipeline {
    agent any
    tools {
        nodejs "Node20"
    }
    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/emak3/Claude3-bot.git'
            }
        }
        stage('Install') {
            steps {
                bat 'npm ci'
            }
        }
        stage('Restart Bot') {
            steps {
                bat 'pm2 start index.js --name "Claude3-bot" || pm2 reload Claude3-bot'
            }
        }
    }
}