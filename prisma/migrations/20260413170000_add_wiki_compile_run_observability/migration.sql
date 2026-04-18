-- AlterTable
ALTER TABLE "wiki_compile_runs" ADD COLUMN "llm_prompt_tokens" INTEGER;
ALTER TABLE "wiki_compile_runs" ADD COLUMN "llm_completion_tokens" INTEGER;
ALTER TABLE "wiki_compile_runs" ADD COLUMN "llm_total_tokens" INTEGER;
ALTER TABLE "wiki_compile_runs" ADD COLUMN "llm_input_chars" INTEGER;

