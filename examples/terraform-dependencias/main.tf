provider "aws" {
  region                      = "us-east-1"
  access_key                  = "mock"
  secret_key                  = "mock"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
}

resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }

# (b) depends_on en la llamada al módulo: todos sus recursos dependen de la VPC.
module "base" {
  source = "./modules/base"
  vpc_id = aws_vpc.main.id

  depends_on = [aws_vpc.main]
}

# Módulo con count.
module "subredes" {
  source = "./modules/subred"
  count  = 2
  vpc_id = aws_vpc.main.id
  index  = count.index
}

# Módulo con for_each.
module "seguridad" {
  source   = "./modules/seguridad"
  for_each = toset(["web", "db"])
  vpc_id   = aws_vpc.main.id
  nombre   = each.key
}

# (a) depends_on a un módulo completo: depende de todos los recursos de base.
resource "aws_instance" "app" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  subnet_id     = module.base.subnet_id

  depends_on = [module.base]
}

# (c) referencias a un módulo suelto dentro de una expresión: length(module.seguridad).
resource "aws_cloudwatch_log_group" "app" {
  name              = "/claritytf/app"
  retention_in_days = 7
  count             = length(module.seguridad)
}
