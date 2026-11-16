package claritytf;

public class PlanException extends RuntimeException {
    public enum Code {
        NO_FILE(400), FILE_TOO_LARGE(413), INVALID_JSON(400),
        NOT_A_PLAN(422), EMPTY_PLAN(422), INTERNAL_ERROR(500);
        public final int status;
        Code(int status) { this.status = status; }
    }

    public final Code code;

    public PlanException(Code code, String detail) {
        super(detail);
        this.code = code;
    }
}