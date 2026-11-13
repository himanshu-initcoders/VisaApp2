pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    APP_DIR = '/opt/visa'
    COMPOSE = 'docker compose -f /opt/visa/docker-compose.yml --project-directory /opt/visa'
  }

  stages {
    stage('Sync to deploy dir') {
      steps {
        sh '''
          set -e
          mkdir -p "${APP_DIR}"
          if command -v rsync >/dev/null 2>&1; then
            rsync -rlD --delete \
              --exclude '.env' \
              --exclude 'neon.dump' \
              --exclude '.git' \
              --exclude 'jenkins_home' \
              ./ "${APP_DIR}/"
          else
            find "${APP_DIR}" -mindepth 1 -maxdepth 1 \
              ! -name '.env' ! -name 'neon.dump' ! -name '.git' \
              -exec rm -rf {} +
            cp -rT ./ "${APP_DIR}/" 2>/dev/null || cp -a ./ "${APP_DIR}/"
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
        // Jenkins runs sh with -xe; set +x before touching secrets so .env is not logged.
        sh '''
          set +x
          set -euo pipefail
          set -a
          # shellcheck disable=SC1091
          . "${APP_DIR}/.env"
          set +a
          : "${POSTGRES_USER:?missing}"
          : "${POSTGRES_PASSWORD:?missing}"
          : "${POSTGRES_DB:?missing}"
          BUILD_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
          echo "Building app image (DATABASE_URL host=127.0.0.1 db=${POSTGRES_DB} user=${POSTGRES_USER})"
          cd "${APP_DIR}"
          # Prefer BuildKit when buildx exists in this Jenkins container; else classic builder.
          if docker buildx version >/dev/null 2>&1; then
            export DOCKER_BUILDKIT=1
          else
            export DOCKER_BUILDKIT=0
            echo "WARN: docker buildx missing in Jenkins image — using classic builder"
          fi
          export BUILD_DATABASE_URL
          docker build \
            --network=host \
            --target runner \
            --secret id=database_url,env=BUILD_DATABASE_URL \
            --build-arg "NEXT_PUBLIC_RAZORPAY_KEY_ID=${NEXT_PUBLIC_RAZORPAY_KEY_ID:-}" \
            --build-arg "NEXT_PUBLIC_TINYMCE_API_KEY=${NEXT_PUBLIC_TINYMCE_API_KEY:-}" \
            -t visa-app:latest \
            .
          echo "Building migrate image"
          docker build --target migrate -t visa-migrate:latest .
        '''
      }
    }

    stage('Migrate') {
      steps {
        sh '''
          set +x
          set -e
          # Image already built above; compose run has no --no-build flag on this CLI
          ${COMPOSE} --profile migrate run --rm migrate
        '''
      }
    }

    stage('Deploy') {
      steps {
        sh '''
          set -e
          ${COMPOSE} up -d --no-build --remove-orphans app caddy
          ${COMPOSE} up -d --no-build jenkins
        '''
      }
    }

    stage('Health') {
      steps {
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

  post {
    failure {
      sh '${COMPOSE} ps || true'
    }
  }
}
