using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Data;
using TodoApi.DTOs;
using TodoApi.Models;
using TaskState = TodoApi.Models.TaskStatus;

namespace TodoApi.Controllers;

[ApiController]
[Route("api/tasks")]
public class TasksController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskItem>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await db.Tasks.AsNoTracking().OrderBy(task => task.Status).ThenBy(task => task.PriorityOrder).ThenBy(task => task.CreatedAt).ToListAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TaskItem>> Get(Guid id, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return task is null ? NotFound() : Ok(task);
    }

    [HttpPost]
    public async Task<ActionResult<TaskItem>> Create(CreateTaskDto dto, CancellationToken cancellationToken)
    {
        var content = dto.Content.Trim();
        if (content.Length == 0) return BadRequest(new { message = "Content is required." });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var todoCount = await db.Tasks.CountAsync(task => task.Status == TaskState.TODO, cancellationToken);
        var task = new TaskItem
        {
            Id = Guid.NewGuid(),
            Content = content,
            CreatedAt = dto.CreatedAt ?? DateTimeOffset.UtcNow,
            PriorityOrder = todoCount + 1,
            IsStarred = dto.IsStarred
        };
        db.Tasks.Add(task);
        await db.SaveChangesAsync(cancellationToken);

        if (dto.PriorityOrder.HasValue)
        {
            await InsertAtPriorityAsync(task, dto.PriorityOrder.Value, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = task.Id }, task);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TaskItem>> Update(Guid id, UpdateTaskDto dto, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return NotFound();
        var content = dto.Content.Trim();
        if (content.Length == 0) return BadRequest(new { message = "Content is required." });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        task.Content = content;
        task.CreatedAt = dto.CreatedAt;
        task.IsStarred = dto.IsStarred;
        if (task.Status == TaskState.TODO && dto.PriorityOrder.HasValue)
            await InsertAtPriorityAsync(task, dto.PriorityOrder.Value, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(task);
    }

    [HttpPatch("{id:guid}/complete")]
    public async Task<ActionResult<TaskItem>> Complete(Guid id, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        task.Status = TaskState.COMPLETED;
        task.CompletedAt = DateTimeOffset.UtcNow;
        task.PriorityOrder = 0;
        await db.SaveChangesAsync(cancellationToken);
        await NormalizeQueueAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(task);
    }

    [HttpPatch("{id:guid}/restore")]
    public async Task<ActionResult<TaskItem>> Restore(Guid id, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        task.Status = TaskState.TODO;
        task.CompletedAt = null;
        task.DeletedAt = null;
        task.PriorityOrder = await db.Tasks.CountAsync(item => item.Status == TaskState.TODO, cancellationToken) + 1;
        await db.SaveChangesAsync(cancellationToken);
        await NormalizeQueueAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(task);
    }

    [HttpPatch("{id:guid}/delete")]
    public async Task<ActionResult<TaskItem>> DeleteToTrash(Guid id, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        task.Status = TaskState.DELETED;
        task.DeletedAt = DateTimeOffset.UtcNow;
        task.PriorityOrder = 0;
        await db.SaveChangesAsync(cancellationToken);
        await NormalizeQueueAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(task);
    }

    [HttpPatch("{id:guid}/priority")]
    public async Task<ActionResult<IEnumerable<TaskItem>>> UpdatePriority(Guid id, PriorityDto dto, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return NotFound();
        if (task.Status != TaskState.TODO) return Conflict(new { message = "Only TODO tasks can be reordered." });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await InsertAtPriorityAsync(task, dto.PriorityOrder, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(await db.Tasks.AsNoTracking().Where(item => item.Status == TaskState.TODO).OrderBy(item => item.PriorityOrder).ToListAsync(cancellationToken));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteForever(Guid id, CancellationToken cancellationToken)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Tasks.Remove(task);
        await db.SaveChangesAsync(cancellationToken);
        await NormalizeQueueAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    private async Task InsertAtPriorityAsync(TaskItem task, int requestedPosition, CancellationToken cancellationToken)
    {
        var queue = await db.Tasks.Where(item => item.Status == TaskState.TODO && item.Id != task.Id).OrderBy(item => item.PriorityOrder).ToListAsync(cancellationToken);
        queue.Insert(Math.Clamp(requestedPosition - 1, 0, queue.Count), task);
        for (var index = 0; index < queue.Count; index++) queue[index].PriorityOrder = index + 1;
    }

    private async Task NormalizeQueueAsync(CancellationToken cancellationToken)
    {
        var queue = await db.Tasks.Where(item => item.Status == TaskState.TODO).OrderBy(item => item.PriorityOrder).ToListAsync(cancellationToken);
        for (var index = 0; index < queue.Count; index++) queue[index].PriorityOrder = index + 1;
    }
}
