variable "vpc_id" { type = string }

resource "aws_security_group" "web" {
  name   = "web"
  vpc_id = var.vpc_id
}