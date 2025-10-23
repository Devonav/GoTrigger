pipeline {
    agent any

    environment {
        // Docker Hub credentials (configure in Jenkins)
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_IMAGE = 'deeplyprofound/password-sync'

        // Production server
        PROD_SERVER = 'root@5.161.200.4'
        DEPLOY_DIR = '/root/app/password-sync'

        // Slack/Discord webhook for notifications (optional)
        SLACK_WEBHOOK = credentials('slack-webhook')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1'
            }
        }

        stage('Test Server') {
            steps {
                dir('server') {
                    sh '''
                        echo "🧪 Running Go tests..."
                        go test ./... -v
                    '''
                }
            }
        }

        stage('Build Server Docker Image') {
            steps {
                sh '''
                    echo "🐳 Building Docker image..."
                    docker build -f deploy/Dockerfile -t ${DOCKER_IMAGE}:${BUILD_NUMBER} .
                    docker tag ${DOCKER_IMAGE}:${BUILD_NUMBER} ${DOCKER_IMAGE}:latest
                '''
            }
        }

        stage('Push to Docker Hub') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        echo "📤 Pushing to Docker Hub..."
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                        docker push ${DOCKER_IMAGE}:${BUILD_NUMBER}
                        docker push ${DOCKER_IMAGE}:latest
                    '''
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                sshagent(['prod-server-ssh']) {
                    sh '''
                        echo "🚀 Deploying to production..."
                        ssh -o StrictHostKeyChecking=no ${PROD_SERVER} "
                            cd ${DEPLOY_DIR} && \
                            docker-compose pull && \
                            docker-compose up -d --force-recreate
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    echo "🏥 Running health check..."
                    sleep 10
                    curl -f http://5.161.200.4:8081/api/v1/health || exit 1
                '''
            }
        }

        stage('Build Desktop Client') {
            when {
                branch 'main'
            }
            steps {
                dir('clients/desktop') {
                    sh '''
                        echo "🖥️ Building desktop client..."
                        npm install
                        npm run build
                    '''
                }
            }
        }

        stage('Archive Artifacts') {
            steps {
                archiveArtifacts artifacts: 'clients/desktop/dist/**/*', fingerprint: true
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully!'
            // Optional: Send Slack notification
            // slackSend color: 'good', message: "Build ${BUILD_NUMBER} succeeded!"
        }
        failure {
            echo '❌ Pipeline failed!'
            // Optional: Send Slack notification
            // slackSend color: 'danger', message: "Build ${BUILD_NUMBER} failed!"
        }
    }
}
