variable "vpc_id" { type = string }
variable "nombre" { type = string }

resource "aws_security_group" "web" {
  name   = var.nombre
  vpc_id = var.vpc_id
}

module "reglas" {
  source = "./modules/reglas"
  sg_id  = aws_security_group.web.id
}
