pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'devonav/password-sync'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        SERVER_IP = '5.161.200.4'
        DEPLOY_DIR = '/root/app/password-sync'
        DOMAIN = 'gotrigger.org'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'echo "🚀 Password Sync CI/CD Pipeline - Build ${BUILD_NUMBER}"'
                sh 'git log -1 --oneline'
            }
        }

        stage('Validate Structure') {
            steps {
                sh '''
                    echo "🔍 Validating project structure..."
                    ls -la
                    echo "--- Checking critical files ---"
                    [ -f deploy/deploy.sh ] && echo "✅ deploy.sh found" || echo "❌ deploy.sh missing"
                    [ -f docker-compose.yml ] && echo "✅ docker-compose.yml found" || echo "❌ docker-compose.yml missing"
                    [ -f deploy/.env.production ] && echo "✅ .env.production found" || echo "❌ .env.production missing"
                    [ -f deploy/docker-compose.prod.yml ] && echo "✅ docker-compose.prod.yml found" || echo "❌ docker-compose.prod.yml missing"
                '''
            }
        }

        stage('Deploy to Production') {
            steps {
                script {
                    sh """
                        echo "🏗️ Starting deployment..."
                        chmod +x deploy/deploy.sh
                        ./deploy/deploy.sh
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                sh """
                    echo "🏥 Running health checks..."
                    sleep 15

                    # Test API health endpoint via HTTPS domain
                    echo "Testing API health on https://${DOMAIN}..."
                    if curl -f https://${DOMAIN}/api/v1/health; then
                        echo "✅ API health check passed!"
                    else
                        echo "❌ API health check failed"
                        echo "Trying direct IP fallback..."
                        if curl -f http://${SERVER_IP}:8081/api/v1/health; then
                            echo "⚠️  API is up but domain might not be configured yet"
                        else
                            exit 1
                        fi
                    fi
                """
            }
        }
    }

    post {
        success {
            echo '🎉 DEPLOYMENT SUCCESSFUL!'
            echo "📱 API: https://${env.DOMAIN}/api/v1/health"
            echo "🔧 Build: ${env.BUILD_NUMBER}"
        }
        failure {
            echo '💥 DEPLOYMENT FAILED!'
            echo "🔧 Build: ${env.BUILD_NUMBER}"
            echo '📋 Check the logs above for errors'
        }
        always {
            echo '🧹 Pipeline cleanup completed'
        }
    }
}
