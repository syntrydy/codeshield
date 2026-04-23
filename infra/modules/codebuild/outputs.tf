output "test_project_name"         { value = aws_codebuild_project.test.name }
output "build_deploy_project_name" { value = aws_codebuild_project.build_deploy.name }
output "terraform_project_name"    { value = aws_codebuild_project.terraform.name }
output "eval_nightly_project_name" { value = aws_codebuild_project.eval_nightly.name }
output "codebuild_role_arn"        { value = aws_iam_role.codebuild.arn }
