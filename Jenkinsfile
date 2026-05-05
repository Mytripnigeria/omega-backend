pipeline{
    agent any

    stages {
        stage("Build"){
            steps{
                slackSend channel: 'deployments', message: '[Omega Backend App]: Starting build...'
                
                withCredentials([file(credentialsId: 'omega-env-secret', variable: 'ENV_FILE')]) {
                    sh '''
                        mkdir -p temp_env
                        cp "$ENV_FILE" temp_env/.env
                        chmod 644 temp_env/.env
                        mv temp_env/.env .env
                        rm -rf temp_env
                    '''
                }

                sh "docker stop omega_backend_app && docker rm -f omega_backend_app"
                sh "docker build -t omega:backend_app ."
                slackSend message: "[Omega Backend App]: Build $BUILD_NUMBER succeeded", color: 'good'
            }
        }

        stage("Deploy"){
            steps{
                slackSend channel: 'deployments', message: '[Omega Backend App]: Starting deployment...'
                sh "docker run --name omega_backend_app -d -p 9091:9091 --env-file .env omega:backend_app"
            }
        }
    }
    post{
        success{
            slackSend message: "[Omega Backend App]: Successfully deployed to production", color: 'good'
        }
        failure{
            slackSend message: "[Omega Backend App]: Build $BUILD_NUMBER failed", color: 'danger'
        }
    }
}