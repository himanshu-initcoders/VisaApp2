pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    // Host path bind-mounted into the Jenkins container (see docker-compose.yml)
    APP_DIR = '/opt/visa'
    COMPOSE = 'docker compose'
  }

  stages {
    stage('Sync to deploy dir') {
      steps {
        sh '''
          set -e
          mkdir -p "${APP_DIR}"
          # Publish workspace → /opt/visa without wiping secrets or DB dumps
          if command -v rsync >/dev/null 2>&1; then
            rsync -a --delete \
              --exclude '.env' \
              --exclude 'neon.dump' \
              --exclude '.git' \
              --exclude 'jenkins_home' \
              ./ "${APP_DIR}/"
          else
            find "${APP_DIR}" -mindepth 1 -maxdepth 1 \
              ! -name '.env' ! -name 'neon.dump' ! -name '.git' \
              -exec rm -rf {} +
            cp -a ./ "${APP_DIR}/"
          fi
          test -f "${APP_DIR}/.env" || {
            echo "Missing ${APP_DIR}/.env — copy from deploy/env.production.example"
            exit 1
          }
          grep -q '^DATABASE_URL=' "${APP_DIR}/.env"
          grep -q '^DOMAIN=' "${APP_DIR}/.env"
        '''
      }
    }

    stage('Build') {
      steps {
        dir("${APP_DIR}") {
          sh '${COMPOSE} build app migrate'
        }
      }
    }

    stage('Migrate') {
      steps {
        dir("${APP_DIR}") {
          // After Neon cutover: apply pending Drizzle migrations (no-op if already applied).
          // Do not run this against an empty DB you still plan to pg_restore into.
          sh '''
            set -e
            ${COMPOSE} up -d db
            ${COMPOSE} --profile migrate run --rm migrate
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        dir("${APP_DIR}") {
          sh '''
            set -e
            ${COMPOSE} up -d --remove-orphans app caddy
            ${COMPOSE} up -d jenkins
          '''
        }
      }
    }

    stage('Health') {
      steps {
        dir("${APP_DIR}") {
          sh '''
            set -e
            for i in $(seq 1 30); do
              if ${COMPOSE} exec -T app curl -fsS http://127.0.0.1:3000/api/health; then
                echo
                echo "Health OK (app container)"
                exit 0
              fi
              echo "Waiting for app health ($i/30)..."
              sleep 2
            done
            echo "App health check failed"
            ${COMPOSE} ps
            ${COMPOSE} logs --tail=80 app || true
            exit 1
          '''
        }
      }
    }
  }

  post {
    failure {
      dir("${APP_DIR}") {
        sh '${COMPOSE} ps || true'
      }
    }
  }
}
