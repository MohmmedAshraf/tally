use Tally\Laravel\Adapter;
use Tally\Laravel\Query\QueryRequest;

$response = (new Adapter(new AccountsGrid))->query(QueryRequest::fromArray($input));
