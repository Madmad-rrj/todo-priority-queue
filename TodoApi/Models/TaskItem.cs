namespace TodoApi.Models;

public class TaskItem
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public TaskStatus Status { get; set; } = TaskStatus.TODO;
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public int PriorityOrder { get; set; }
    public bool IsStarred { get; set; }
}
