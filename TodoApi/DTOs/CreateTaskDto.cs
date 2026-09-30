using System.ComponentModel.DataAnnotations;

namespace TodoApi.DTOs;

public class CreateTaskDto
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset? CreatedAt { get; set; }
    [Range(1, int.MaxValue)]
    public int? PriorityOrder { get; set; }
    public bool IsStarred { get; set; }
}
