resource "terraform_data" "a" { input = "v2" }   # update
resource "terraform_data" "c" { input = "nuevo" } # create
# b eliminado                                      # delete